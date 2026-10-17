import { dehydrate, hydrate, MutationObserver, onlineManager } from "@tanstack/preact-query";
import { afterEach, describe, expect, it } from "vitest";
import type { Action } from "../actions";
import { demoTables } from "../mock";
import { buildModel, type Tables } from "../model";
import { backendFor, DEMO_URL, setConfig } from "./backend";
import { createQueryClient, pendingActions, persistOptions, resumeWrites, SHEET, tablesKey } from "./queryClient";

const demo = { url: DEMO_URL, token: "" };
const write = (qc: ReturnType<typeof createQueryClient>, a: Action) =>
  new MutationObserver<void, Error, Action>(qc, { mutationKey: SHEET }).mutate(a).catch(() => undefined);

afterEach(() => onlineManager.setOnline(true));

describe("sheet writes", () => {
  it("apply optimistically before the sheet answers", async () => {
    setConfig(demo);
    const qc = createQueryClient();
    qc.setQueryData(tablesKey(DEMO_URL), demoTables());
    const done = write(qc, { action: "setPantry", name: "boczek", have: true });
    await new Promise(r => setTimeout(r, 10)); // demo backend answers after 120 ms
    const t = qc.getQueryData<Tables>(tablesKey(DEMO_URL))!;
    expect(buildModel(t).pantry.get("boczek")?.have).toBe(true);
    await done;
    expect(buildModel(await backendFor(demo).all()).pantry.get("boczek")?.have).toBe(true);
  });

  it("survive a reload while offline and reach the sheet in order", async () => {
    setConfig(demo);
    onlineManager.setOnline(false);
    const before = qcWithData();
    void write(before, { action: "addExtra", items: ["pierwsze"] });
    void write(before, { action: "addExtra", items: ["drugie"] });
    await new Promise(r => setTimeout(r, 10));
    expect(pendingActions(before)).toHaveLength(2);

    // what the persister stores, restored into a fresh client ("after reload")
    const snapshot = JSON.parse(JSON.stringify(dehydrate(before, persistOptions.dehydrateOptions)));
    const after = createQueryClient();
    hydrate(after, snapshot);
    expect(pendingActions(after).map(a => a.action === "addExtra" && a.items[0])).toEqual(["pierwsze", "drugie"]);

    onlineManager.setOnline(true);
    await resumeWrites(after);
    const items = buildModel(await backendFor(demo).all()).extra.map(x => x.item);
    expect(items.indexOf("pierwsze")).toBeGreaterThanOrEqual(0);
    expect(items.indexOf("pierwsze")).toBeLessThan(items.indexOf("drugie"));
    expect(pendingActions(after)).toHaveLength(0);
  });

  it("refetch keeps writes that haven't reached the sheet yet", async () => {
    setConfig(demo);
    onlineManager.setOnline(false);
    const qc = qcWithData();
    void write(qc, { action: "addExtra", items: ["jeszcze nie wysłane"] });
    await new Promise(r => setTimeout(r, 10));
    const t = await qc.fetchQuery({ queryKey: tablesKey(DEMO_URL), staleTime: 0 });
    expect(buildModel(t as Tables).extra.map(x => x.item)).toContain("jeszcze nie wysłane");
  });
});

function qcWithData() {
  const qc = createQueryClient();
  qc.setQueryData(tablesKey(DEMO_URL), demoTables());
  return qc;
}
