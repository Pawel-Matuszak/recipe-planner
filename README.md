# Obiadki (recipe-planner)

A mobile app (PWA) for recipes, shared by a household. It shows what you can cook with what you have at home,
keeps a list of dishes to cook, and builds the shopping list by itself.

- **Accounts and households:** sign in with email and password; household members share one pantry, plan and shopping list. Invite others with a code (Settings → Konto).
- **Recipes:** one shared catalog, edited by admins. Search, filters (time, type, category, "not made yet") and **"Mogę zrobić teraz"** (Can make now), which sorts by the fewest missing ingredients. Plus **Losuj** (Random) for days with no ideas.
- **Recipe card:** description and steps, ingredients marked as have / missing (tap to toggle), recipe links, adding to the to-cook list, and the household's own "made it", rating and note. Admins get **Edytuj** (Edit) for the description, steps and ingredients; ingredient names missing from the catalog are shown in red, with a suggested name to switch to (other word order, missing Polish letters, typos) or a button to add a new product.
- **Plan (to cook):** a list of dishes without assigned days, either from recipes or typed in as text. Checking one off marks the dish as cooked.
- **Shopping:** missing ingredients for all dishes on the to-cook list, grouped by store section, plus items added by hand.
- **Pantry:** every product in the catalog, with what the household has. "Always have" items (salt, oil…) never count as missing.

Works offline: data is stored on the phone, and changes wait in a queue and are sent once the connection is back.

## Architecture

```
iPhone (PWA) ──cookie session──▶ Next.js route handlers (/api/*) ──Prisma──▶ Postgres (Neon; Docker locally)
```

> Migration in progress (branch `db-migration`), from Google Sheets + Apps Script + GitHub Pages:
> phases 1–4 done (Next.js, database, accounts and households, the app on the database); phase 5 (sheet import) in progress.
> Next: importing the real spreadsheet, admin recipe editor, deploying on Vercel.

- `src/`: Next.js App Router + React + TypeScript, TanStack Query, Tailwind CSS, Serwist for the PWA.
  - `app/`: layout, the single client page, web manifest, service worker (`sw.ts`, served by `serwist/[path]/route.ts`) and the API:
    - `api/state`: GET the household's snapshot (recipes with the household's own state, the product catalog with its pantry flags, plan, shopping extras).
    - `api/actions`: POST one write (see below).
    - `api/household`: GET your account and household, POST `{ op: "create" | "invite" | "join" | "leave" }`.
    - `api/auth/[...all]`: Better Auth.
  - `model.ts`: pure functions (missing ingredients, filters, shopping list, amounts). `State` is the JSON snapshot the server sends; `buildModel` turns it into the `Model` the views use. `parseSheet` reads spreadsheet tabs (demo data and the one-off import).
  - `actions.ts`: every write the app makes, as a zod schema shared by client and server, plus `applyAction`, the optimistic update on the phone. The server does the same change in the database (`server/kitchen/actions.ts`); a test checks both end in the same state.
  - `data/`: API client (`backend.ts`), TanStack Query (`queryClient.ts`, `sheet.ts`) and the account/household client (`account.ts`). Data and unsent writes are saved to `localStorage`, so the app works offline and writes are sent in order once the connection is back. New plan entries and shopping items get their id on the phone, so a write sent twice changes nothing.
  - `state/`: UI state (Preact signals via `@preact/signals-react`): current tab, filters, open recipe.
  - `components/`: React views. Settings is the entry point: sign in, create or join a household, or try the demo.
  - `server/`: backend code (server only), one folder per area:
    - `db.ts`: Prisma client. `http.ts`: session and household checks, JSON body validation (zod) and error responses. `errors.ts`: expected failures with a Polish message.
    - `identity/auth.ts`: Better Auth (email + password, 60-day sessions, `user`/`admin` roles).
    - `households/`: `rules.ts` (pure rules: who becomes owner, invite codes) and `service.ts` (create, invite, join, leave).
    - `catalog/`: shared products (`ingredients.ts`) and recipe editing (`recipes.ts`); admin-only parts are checked in `kitchen/actions.ts`.
    - `kitchen/`: the household's data: `state.ts` (read side, GET /api/state) and `actions.ts` (write side, POST /api/actions).
    - `import/`: `fromModel.ts` loads sheet-shaped data into the database (demo seed and sheet import); `report.ts` lists what to fix in the sheet; `sheet.ts` replaces the catalog with the sheet and checks the result.
- `prisma/`: `schema.prisma` (tables), `migrations/` (committed SQL), `seed.ts` (demo data and a demo admin).
- `apps-script/Code.gs`: the old backend bound to the "Obiadki2" spreadsheet; kept until the one-off import of the real data is done.

## Installing on iPhone

Open https://pawel-matuszak.github.io/recipe-planner/ in Safari → Share → **Add to Home Screen**.

## Development

```bash
npm install
npm run dev:mock   # app with sample data only, no database or account needed
npm run dev:local  # app on the local Docker database (sign in as demo@obiadki.local / demo-demo after `npm run db:seed`)
npm run dev        # app on the database from .env.local (Neon dev branch)
npm test           # unit tests and database tests (vitest; database tests need `npm run db:up`)
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
npx tsx scripts/set-role.ts you@example.com admin   # make a signed-up user an admin (database from DATABASE_URL)
```

Tests: `*.db.test.ts` files run against the local test database (`npm run test:db`), everything else is a plain unit test (`npm run test:unit`).

Environment (`.env.local`, see `.env.example`):
- `DATABASE_URL`: what the app uses at runtime; on Neon the **pooled** connection string (host contains `-pooler`).
- `DIRECT_URL`: used by migrations; on Neon the **unpooled** connection string.
- `TEST_DATABASE_URL`: the local test database; the db tests refuse to run against anything that isn't local.
- `BETTER_AUTH_SECRET`: random secret that signs session cookies (32+ characters, different per environment).
- `BETTER_AUTH_URL`: the app's public URL (`http://localhost:3000` locally).

The seed also refuses to run against a non-local database unless `SEED_ALLOW_REMOTE=1` (it wipes the database first).

### Database

Postgres 18 (Neon in the cloud: `production` branch = prod, `dev` branch = dev; Docker locally). Main tables:

| Area | Tables |
|---|---|
| Identity (Better Auth) | `user` (with `role`: user/admin), `session`, `account`, `verification` |
| Households | `household`, `household_member` (one household per user), `household_invite` (8-character code, valid 7 days) |
| Catalog (global, edited by admins) | `recipe`, `recipe_ingredient`, `recipe_step`, `recipe_link`, `recipe_category`, `ingredient`, `department`, `recipe_type`, `category` |
| Kitchen (per household) | `pantry_item`, `plan_entry`, `shopping_extra`, `household_recipe_state` (done, rating, notes) |

Glossary (UI → code): Spiżarnia → pantry · Dział → department · Mam → have · Zawsze mam → always · Do ugotowania → plan ·
Zakupy extra → shopping extra · Było robione → done · Ocena → rating · Notatki → notes · Typ → recipe type · Kategoria → category.

### Importing the spreadsheet

`npm run db:import` reads the sheet through the Apps Script web app (`SHEET_URL`, `SHEET_TOKEN` in `.env.local`) or a saved export (`-- --file export.json`; `-- --save export.json` keeps one).
Without flags it only prints a report: duplicate IDs (errors), likely typos, products missing from the pantry, values the database can't keep.

```sh
npm run db:import                                                    # report only
npm run db:import -- --owner you@example.com --apply --host <db host>  # replace recipes/products, load your kitchen
```

The owner must have an account in that database. Their household (created if needed) gets the pantry, plan and extras; accounts and members stay.
It refuses if another household already has data, and needs `--host` for anything but localhost. Afterwards it compares the app's view with the sheet,
including the shopping list for the current plan. Running it again replaces the same data.

CI (`.github/workflows/ci.yml`) runs the typecheck, tests and build on every PR and push to `main`.
Deploys will go through Vercel's Git integration (set up in a later migration phase).
