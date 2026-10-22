// @vitest-environment happy-dom
import { QueryClientProvider } from "@tanstack/preact-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";
import { DEMO_URL, setConfig } from "../data/backend";
import { createQueryClient } from "../data/queryClient";
import { filtersOpen, openRecipe, resetFilters, tab } from "../state/ui";
import { App } from "./App";

function renderApp() {
  setConfig({ url: DEMO_URL, token: "" });
  return render(<QueryClientProvider client={createQueryClient()}><App /></QueryClientProvider>);
}

afterEach(() => { cleanup(); tab.value = "przepisy"; filtersOpen.value = false; openRecipe.value = null; resetFilters(); });

describe("App with demo data", () => {
  it("narrows recipes from the filter sheet and clears a filter from its chip", async () => {
    renderApp();
    await screen.findByText("Carbonara");
    expect(screen.getByText("Placki ziemniaczane")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Filtry"));
    fireEvent.click(await screen.findByLabelText("do 15 min"));
    await waitFor(() => expect(screen.queryByText("Placki ziemniaczane")).toBeNull());
    expect(screen.getByText("Egg fried rice")).toBeTruthy();
    expect(screen.getByLabelText("Filtry, aktywne: 1")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Usuń filtr: do 15 min"));
    expect(await screen.findByText("Placki ziemniaczane")).toBeTruthy();
  });

  it("opens a recipe and toggles an ingredient", async () => {
    renderApp();
    fireEvent.click(await screen.findByText("Leczo"));
    const ing = await screen.findByText("cukinia");
    fireEvent.click(ing.closest("button")!);
    await waitFor(() => expect(ing.closest("button")!.getAttribute("aria-pressed")).toBe("true"));
  });

  it("edits a recipe's steps from the recipe view", async () => {
    renderApp();
    fireEvent.click(await screen.findByText("Leczo"));
    fireEvent.click(await screen.findByText("Edytuj"));
    fireEvent.input(screen.getByLabelText("Kroki"), { target: { value: "Pokrój warzywa\nDuś 20 minut" } });
    fireEvent.click(screen.getByText("Zapisz"));
    expect(await screen.findByText("Duś 20 minut")).toBeTruthy();
    expect(screen.queryByText("Zapisz")).toBeNull();
  });

  it("offers a pantry name for a misspelled ingredient and adds a new one to the pantry", async () => {
    renderApp();
    fireEvent.click(await screen.findByText("Leczo"));
    fireEvent.click(await screen.findByText("Edytuj"));
    const field = screen.getByLabelText("Składniki") as HTMLTextAreaElement;
    fireEvent.input(field, { target: { value: "cebula: 2\npomidor: 4\npinsa" } });
    fireEvent.click(await screen.findByText("Zamień na „pomidory”"));
    expect(field.value).toBe("cebula: 2\npomidory: 4\npinsa");
    fireEvent.change(screen.getByLabelText("Dział: pinsa"), { target: { value: "Pieczywo" } });
    fireEvent.click(screen.getByText("Dodaj do bazy"));
    await waitFor(() => expect(screen.queryByText("Dodaj do bazy")).toBeNull());
    fireEvent.click(screen.getByText("Zapisz"));
    expect(await screen.findByText("pinsa")).toBeTruthy();
    expect(screen.queryByText(/poza bazą/)).toBeNull();
  });

  it("renders every tab", async () => {
    renderApp();
    await screen.findByText("Carbonara");
    fireEvent.click(screen.getByText("Plan"));
    expect(await screen.findByText("Ostatnio ugotowane")).toBeTruthy();
    fireEvent.click(screen.getByText("Zakupy"));
    expect(await screen.findByText("Dopisane ręcznie")).toBeTruthy();
    fireEvent.click(screen.getAllByText("Spiżarnia").at(-1)!);
    expect(await screen.findByText("Dodaj składnik")).toBeTruthy();
  });
});
