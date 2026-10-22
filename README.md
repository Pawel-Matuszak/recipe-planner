# Obiadki (recipe-planner)

A mobile app (PWA) for my recipes stored in Google Sheets. It shows what I can cook with what I have at home,
keeps a list of dishes to cook, and builds the shopping list by itself.

- **Recipes:** search, filters (time, type, category, "not made yet") and **"Mogę zrobić teraz"** (Can make now), which sorts by the fewest missing ingredients. Plus **Losuj** (Random) for days with no ideas.
- **Recipe card:** description and steps, ingredients marked as have / missing (tap to toggle), recipe links, adding to the to-cook list, rating and a note. **Edytuj** (Edit) lets you fix the description, steps and ingredients in the app; saving changed ingredients marks them as checked. Ingredient names missing from the pantry are shown in red, with a suggested pantry name to switch to (other word order, missing Polish letters, typos) or a button to add them to the pantry as a new product.
- **Plan (to cook):** a list of dishes without assigned days, either from recipes or typed in as text. Checking one off marks the dish as cooked.
- **Shopping:** missing ingredients for all dishes on the to-cook list, grouped by store section, plus items added by hand.
- **Pantry:** what I have at home. "Always have" items (salt, oil…) never count as missing.

Works offline: data is stored on the phone, and changes wait in a queue and are sent once the connection is back.

## Architecture

```
iPhone (PWA, GitHub Pages) ──fetch + token──▶ Apps Script web app ──▶ "Obiadki2" spreadsheet
```

- `src/`: frontend (Vite + Preact + TypeScript, TanStack Query, Tailwind CSS).
  - `model.ts`: pure functions (missing ingredients, filters, shopping list). The whole sheet is loaded once and filtered on the phone.
  - `actions.ts`: writes applied locally (optimistically) and in demo mode.
  - `data/`: Apps Script client (`backend.ts`) and TanStack Query (`queryClient.ts`, `sheet.ts`). Data and unsent changes are saved to `localStorage` by the persister, so the app works offline and changes are sent in order once the connection is back.
  - `state/`: UI state (Preact signals): current tab, filters, open recipe.
  - `components/`: Preact views.
- `apps-script/Code.gs`: backend bound to the spreadsheet. `GET ?action=all` returns the whole sheet, and `POST` accepts the actions from `src/actions.ts`.
- Spreadsheet: tabs `Main` (recipes, columns are matched by header, e.g. `Opis` for the description and `Przepis` for the steps, one per line; `Poza bazą` is a formula listing ingredients missing from `Spiżarnia`, and those rows are highlighted red), `Spiżarnia` (pantry), `Plan2` and `Zakupy_extra` (extra shopping items).

The script URL and token are **not in the repo**. You enter them once in the app's Settings and they stay on the phone.

## Backend deployment (once)

1. Open the "Obiadki2" spreadsheet → **Extensions → Apps Script**.
2. Paste the contents of `apps-script/Code.gs` into `Code.gs` (replacing everything) and save.
3. Select the `setupToken` function → **Run** and accept the permissions.
   The token appears in the **Execution log**. Copy it.
4. **Deploy → New deployment → Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Copy the URL ending in `/exec`.
6. Open the app and enter the URL and token in **Settings**.

After changing `Code.gs`: **Deploy → Manage deployments → edit → Version: New version**. The URL stays the same.

Security: anyone who knows the URL **and** the token can read and change the recipes in the sheet. Don't share the token.
To change it, run `setupToken` again and enter the new token in the app.

## Installing on iPhone

Open https://pawel-matuszak.github.io/recipe-planner/ in Safari → Share → **Add to Home Screen**.

## Development

```bash
npm install
npm run dev:mock   # app with sample data, no spreadsheet needed
npm run dev        # app with the real spreadsheet (URL and token in Settings)
npm test           # model, action, sync and view tests (vitest)
npm run build      # production build to dist/
npm run icons      # generate PWA icons into public/icons
```

A push to `main` runs the tests, the build and the deploy to GitHub Pages (`.github/workflows/deploy.yml`).
In the repo settings: **Settings → Pages → Source: GitHub Actions**.
