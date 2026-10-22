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
iPhone (PWA, Next.js) ──fetch + token──▶ Apps Script web app ──▶ "Obiadki2" spreadsheet
```

> Migration in progress (branch `db-migration`): moving to Next.js on Vercel with Neon Postgres, Prisma and Better Auth.
> Phase 1 (done): the app runs on Next.js + React. It still talks to Apps Script.
> Phase 2 (done): Postgres schema and migrations (Prisma), demo seed, database tests. Not used by the app yet.

- `src/`: frontend (Next.js App Router + React + TypeScript, TanStack Query, Tailwind CSS, Serwist for the PWA).
  - `app/`: Next.js entry: layout, the single client page, web manifest and service worker (`sw.ts`, served by `serwist/[path]/route.ts`).
  - `model.ts`: pure functions (missing ingredients, filters, shopping list). The whole sheet is loaded once and filtered on the phone.
  - `actions.ts`: writes applied locally (optimistically) and in demo mode.
  - `data/`: Apps Script client (`backend.ts`) and TanStack Query (`queryClient.ts`, `sheet.ts`). Data and unsent changes are saved to `localStorage` by the persister, so the app works offline and changes are sent in order once the connection is back.
  - `state/`: UI state (Preact signals via `@preact/signals-react`): current tab, filters, open recipe.
  - `components/`: React views.
  - `server/`: backend code (server only). `db.ts` is the Prisma client; `import/fromModel.ts` loads sheet-shaped data into the database (demo seed, and later the one-off sheet import).
- `prisma/`: `schema.prisma` (tables), `migrations/` (committed SQL), `seed.ts` (demo data).
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
npm run typecheck  # tsc
npm run build      # production build (Next.js, .next/)
npm run icons      # generate PWA icons into public/icons
```

Local database (needs Docker Desktop running): `cp .env.example .env.local`, then

```bash
npm run db:up      # Postgres 18 on localhost:54322, databases `obiadki` (dev) and `obiadki_test` (tests)
npm run db:down    # stop it (data is kept in a Docker volume)
npm run db:reset   # stop and wipe all local data
npm run db:migrate # after editing schema.prisma: create a migration and apply it to the local dev database
npm run db:seed    # replace the local dev database's contents with the demo data
npm run test:db    # database tests only (always on the local `obiadki_test` database)
npm run db:deploy  # apply committed migrations to the database in .env.local DIRECT_URL (Neon dev branch)
```

Environment (`.env.local`, see `.env.example`):
- `DATABASE_URL`: what the app uses at runtime; on Neon the **pooled** connection string (host contains `-pooler`).
- `DIRECT_URL`: used by migrations; on Neon the **unpooled** connection string.
- `TEST_DATABASE_URL`: the local test database; the db tests refuse to run against anything that isn't local.

The seed also refuses to run against a non-local database unless `SEED_ALLOW_REMOTE=1` (it wipes the database first).

### Database

Postgres 18 (Neon in the cloud: `production` branch = prod, `dev` branch = dev; Docker locally). Main tables:

| Area | Tables |
|---|---|
| Identity (Better Auth) | `user` (with `role`: user/admin), `session`, `account`, `verification` |
| Households | `household`, `household_member`, `household_invite` |
| Catalog (global, edited by admins) | `recipe`, `recipe_ingredient`, `recipe_step`, `recipe_link`, `recipe_category`, `ingredient`, `department`, `recipe_type`, `category` |
| Kitchen (per household) | `pantry_item`, `plan_entry`, `shopping_extra`, `household_recipe_state` (done, rating, notes) |

Glossary (UI → code): Spiżarnia → pantry · Dział → department · Mam → have · Zawsze mam → always · Do ugotowania → plan ·
Zakupy extra → shopping extra · Było robione → done · Ocena → rating · Notatki → notes · Typ → recipe type · Kategoria → category.

CI (`.github/workflows/ci.yml`) runs the typecheck, tests and build on every PR and push to `main`.
Deploys will go through Vercel's Git integration (set up in a later migration phase).
