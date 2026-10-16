import { useEffect } from "preact/hooks";
import { config } from "../data/backend";
import { toastMsg } from "../state/toast";
import { openRecipe, randomMode, settingsOpen, tab, type Tab } from "../state/ui";
import { Header } from "./Header";
import { Icon } from "./Icon";
import { PantryView } from "./PantryView";
import { PlanView } from "./PlanView";
import { RecipeSheet } from "./RecipeSheet";
import { RecipesView } from "./RecipesView";
import { SettingsSheet } from "./SettingsSheet";
import { ShoppingView } from "./ShoppingView";

const TABS: [Tab, string][] = [["przepisy", "Przepisy"], ["plan", "Plan"], ["zakupy", "Zakupy"], ["spizarnia", "Spiżarnia"]];
const VIEWS = { przepisy: RecipesView, plan: PlanView, zakupy: ShoppingView, spizarnia: PantryView };

function TabBar() {
  const go = (k: Tab) => { tab.value = k; window.scrollTo(0, 0); };
  return (
    <nav class="fixed inset-x-0 bottom-0 z-25 grid grid-cols-[repeat(4,minmax(0,170px))] justify-center border-t border-line bg-surface"
      style={{ padding: "0 env(safe-area-inset-right, 0px) env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px)" }} aria-label="Sekcje">
      {TABS.map(([k, label]) => (
        <button key={k} class={`grid h-tab place-items-center content-center gap-0.5 text-[.78rem] font-bold [&_svg]:size-6 ${tab.value === k ? "text-basil" : "text-muted"}`}
          aria-current={tab.value === k ? "page" : undefined} onClick={() => go(k)}>
          <Icon name={k} /><span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

function Overlay() {
  const showSettings = settingsOpen.value || !config.value;
  const open = showSettings || !!openRecipe.value;
  useEffect(() => {
    document.body.classList.toggle("locked", open);
  }, [open]);
  if (!open) return null;
  return (
    <div class="fixed inset-0 z-40 overflow-y-auto bg-bg" style={{ padding: "env(safe-area-inset-top, 0px) 0 env(safe-area-inset-bottom, 0px)" }}>
      {showSettings ? <SettingsSheet /> : <RecipeSheet />}
    </div>
  );
}

function Toast() {
  const t = toastMsg.value;
  if (!t) return null;
  return (
    <div key={t.id} role="status" class="toast fixed left-1/2 z-50 max-w-[calc(100%-32px)] -translate-x-1/2 rounded-full bg-ink px-4 py-2.5 text-[.9rem] text-bg shadow-[0_6px_20px_rgb(0_0_0/.2)]"
      style={{ bottom: "calc(var(--spacing-tab) + 14px + env(safe-area-inset-bottom, 0px))" }}>
      {t.text}
    </div>
  );
}

export function App() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (openRecipe.value) { openRecipe.value = null; randomMode.value = false; }
      else if (settingsOpen.value) settingsOpen.value = false;
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const View = VIEWS[tab.value];
  return (
    <>
      <div class="wrap" style={{ paddingBottom: "calc(var(--spacing-tab) + 24px + env(safe-area-inset-bottom, 0px))" }}>
        <Header />
        <main><View /></main>
      </div>
      <TabBar />
      <Overlay />
      <Toast />
    </>
  );
}
