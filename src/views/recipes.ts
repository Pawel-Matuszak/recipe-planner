import { filterRecipes, missingOf, plural, type Recipe } from "../model";
import { S } from "../state";
import { esc } from "../ui";

export function missBadge(r: Recipe): string {
  if (!r.ing.length) return `<span class="badge b-unk">brak składników</span>`;
  const n = missingOf(S.model!, r).length;
  return n === 0 ? `<span class="badge b-ok">masz wszystko</span>` : `<span class="badge b-miss">brakuje ${n}</span>`;
}

export function renderRecipes(): string {
  if (!S.model) return `<div class="empty">Wczytuję przepisy z arkusza…</div>`;
  const list = filterRecipes(S.model, S.f);
  const head = `<p class="count">${list.length} ${plural(list.length, "przepis", "przepisy", "przepisów")}${S.f.can ? " · od najmniejszej liczby braków" : ""}</p>`;
  if (!list.length) return head + `<div class="empty">Nic nie pasuje do filtrów. Wyłącz któryś filtr albo zmień wyszukiwanie.</div>`;
  return head + `<div class="list">${list.map(card).join("")}</div>`;
}

function card(r: Recipe): string {
  const idea = r.cats.includes("Pomysł");
  const meta = [
    r.time ? `${r.time} min` : "", r.diff, r.type, ...r.cats.filter(c => c !== "Pomysł"),
    r.done ? "✓ robione" : "", idea ? "pomysł" : "", r.rate ? "★".repeat(r.rate) : "",
  ].filter(Boolean);
  return `<button class="card" data-open="${esc(r.id)}">
    <span class="name">${esc(r.name)}</span>${missBadge(r)}
    <span class="meta">${meta.map(x => `<span>${esc(x)}</span>`).join("")}</span>
  </button>`;
}
