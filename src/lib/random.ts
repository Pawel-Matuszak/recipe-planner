import { filterRecipes, randomPool, type Model } from "../model";
import { filters, openRecipe, randomMode } from "../state/ui";
import { toast } from "../state/toast";

/** "Losuj": open a random recipe matching the filters, never the same one twice in a row. */
export function randomPick(m: Model) {
  const f = filters.value;
  const pool = randomPool(m, filterRecipes(m, f), f.type === "Wszystkie" && !f.q);
  if (!pool.length) { toast("Brak dań pasujących do filtrów"); return; }
  let pick = pool[Math.floor(Math.random() * pool.length)];
  if (pool.length > 1 && pick.id === openRecipe.value) pick = pool.find(r => r.id !== openRecipe.value)!;
  randomMode.value = true;
  openRecipe.value = pick.id;
}
