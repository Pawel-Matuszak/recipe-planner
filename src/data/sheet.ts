// Hooks the components use: the model, writes, sync status and connection changes.
import { useIsMutating, useMutation, useMutationState, useQuery, type QueryClient } from "@tanstack/preact-query";
import type { Action } from "../actions";
import { buildModel, type Model, type Recipe, type Tables } from "../model";
import { toast } from "../state/toast";
import { backendFor, config, DEMO_URL, errorMessage, setConfig, type Config } from "./backend";
import { persister, resumeWrites, SHEET, tablesKey } from "./queryClient";
import { store } from "./storage";

export function useSheet() {
  const c = config.value;
  return useQuery({ queryKey: tablesKey(c?.url ?? ""), enabled: !!c, select: buildModel });
}

/** The current model, or null while nothing is loaded yet. */
export const useModel = (): Model | null => useSheet().data ?? null;

export function useRecipe(id: string | null): Recipe | undefined {
  const m = useModel();
  return id ? m?.recipes.find(r => r.id === id) : undefined;
}

/** Optimistic write: shows up immediately, survives reloads, reaches the sheet when it can. */
export function useAct() {
  const { mutate } = useMutation<void, Error, Action>({ mutationKey: SHEET });
  return mutate;
}

export interface SyncStatus {
  kind: "setup" | "connecting" | "busy" | "ok" | "error";
  hasData: boolean;
  demo: boolean;
  pending: number;
  message: string; // shown in the banner
}

export function useSyncStatus(): SyncStatus {
  const q = useSheet();
  const pending = useIsMutating({ mutationKey: SHEET });
  const writeErrors = useMutationState({ filters: { mutationKey: SHEET, status: "pending" }, select: m => m.state.failureReason });
  const c = config.value;
  const hasData = !!q.data;
  let kind: SyncStatus["kind"] = "connecting";
  if (!c) kind = "setup";
  else if (q.isFetching) kind = "busy";
  else if (q.isError) kind = "error";
  else if (q.isSuccess) kind = "ok";
  const writeError = writeErrors.find(Boolean);
  const message = q.isError && !q.isFetching
    ? errorMessage(q.error, "Nie udało się połączyć z arkuszem.")
    : writeError ? errorMessage(writeError, "") : "";
  return { kind, hasData, demo: c?.url === DEMO_URL, pending, message };
}

export async function refresh(qc: QueryClient, manual: boolean) {
  const c = config.value;
  if (!c) return;
  void qc.resumePausedMutations();
  void resumeWrites(qc);
  await qc.refetchQueries({ queryKey: tablesKey(c.url) });
  if (manual && qc.getQueryState(tablesKey(c.url))?.status === "success") toast("Odświeżono z arkusza");
}

/** Drops everything tied to the previous sheet (cached data and unsent writes). */
function resetData(qc: QueryClient) {
  qc.getMutationCache().clear();
  qc.clear();
}

/** Validates the connection by loading the sheet, then switches to it. Throws a user-facing message on failure. */
export async function connect(qc: QueryClient, c: Config) {
  let t: Tables;
  try {
    t = await backendFor(c).all();
    buildModel(t); // throws on a malformed payload
  } catch (e) {
    throw new Error(errorMessage(e, "Nie udało się połączyć. Sprawdź adres i token."));
  }
  if (config.value?.url !== c.url) resetData(qc);
  setConfig(c);
  qc.setQueryData(tablesKey(c.url), t);
}

export function connectDemo(qc: QueryClient) {
  if (config.value?.url !== DEMO_URL) resetData(qc);
  setConfig({ url: DEMO_URL, token: "" });
}

export function forget(qc: QueryClient) {
  resetData(qc);
  void persister.removeClient();
  store.clear();
  setConfig(null);
}

