// @vitest-environment happy-dom
import { QueryClientProvider } from "@tanstack/preact-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";
import { DEMO_URL, setConfig } from "../data/backend";
import { createQueryClient } from "../data/queryClient";
import { tab } from "../state/ui";
import { App } from "./App";

function renderApp() {
  setConfig({ url: DEMO_URL, token: "" });
  return render(<QueryClientProvider client={createQueryClient()}><App /></QueryClientProvider>);
}

afterEach(() => { cleanup(); tab.value = "przepisy"; });

describe("App with demo data", () => {
  it("lists recipes and narrows them with a filter chip", async () => {
    renderApp();
    await screen.findByText("Carbonara");
    expect(screen.getByText("Placki ziemniaczane")).toBeTruthy();
    fireEvent.click(screen.getByText("≤ 15 min"));
    await waitFor(() => expect(screen.queryByText("Placki ziemniaczane")).toBeNull());
    expect(screen.getByText("Egg fried rice")).toBeTruthy();
    fireEvent.click(screen.getByText("≤ 15 min"));
  });

  it("opens a recipe and toggles an ingredient", async () => {
    renderApp();
    fireEvent.click(await screen.findByText("Leczo"));
    const ing = await screen.findByText("cukinia");
    fireEvent.click(ing.closest("button")!);
    await waitFor(() => expect(ing.closest("button")!.textContent).toContain("dotknij: brak"));
  });

  it("renders every tab", async () => {
    renderApp();
    await screen.findByText("Carbonara");
    fireEvent.click(screen.getByText("Plan"));
    expect(await screen.findByText("Poniedziałek")).toBeTruthy();
    fireEvent.click(screen.getByText("Zakupy"));
    expect(await screen.findByText("Dopisane ręcznie")).toBeTruthy();
    fireEvent.click(screen.getAllByText("Spiżarnia").at(-1)!);
    expect(await screen.findByText("Dodaj składnik")).toBeTruthy();
  });
});
