# Health Tracker

A personal, single-user health tracker: a manually curated ingredient library, meals composed from it, a daily food diary, and a weight log with a goal weight. See [DESIGN.md](./DESIGN.md).

## Layout

```
health-tracker/
├── DESIGN.md
├── apps/
│   ├── api/                 # Fastify + TypeScript API, SQLite via Drizzle
│   └── web/                 # React + Vite frontend
└── packages/
    └── shared/              # Shared types, Zod schemas, nutrition helpers
```

`packages/shared` is the single source of truth for the domain: the Zod schemas it exports validate every request, serialise every response, and generate the OpenAPI document, so the contract cannot drift from the code.

## Getting started

```bash
npm install
npm run build          # builds packages/shared, apps/api, then apps/web
npm run migrate        # creates apps/api/data/health-tracker.sqlite
npm run seed -w @health-tracker/api   # optional: loads the DESIGN.md worked example
npm run dev            # API on :3000 and web on :5173 (proxied /api)
```

The UI is at **http://127.0.0.1:5173**. Interactive API docs are at **http://127.0.0.1:3000/docs**, and the raw document at `/docs/json`. `npm run openapi -w @health-tracker/api -- openapi.json` writes it to a file for client generation.

```bash
npm test               # 41 tests covering the design's guarantees
npm run typecheck
```

### Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `HOST` | `127.0.0.1` | Listen address |
| `PORT` | `3000` | Listen port |
| `DATABASE_URL` | `apps/api/data/health-tracker.sqlite` | SQLite file path, or `:memory:` |
| `LOG_LEVEL` | `info` | Pino log level |

Backups are a file copy: stop the server and copy the SQLite file.

## API

Base path `/api`. Everything is documented in Swagger UI; this is the shape of it:

| Method | Path | Description |
|--------|------|-------------|
| `GET` `POST` | `/ingredients` | List / create |
| `GET` `PUT` `DELETE` | `/ingredients/:id` | Read / update / delete (`?force=true`) |
| `GET` `POST` | `/meals` | List / create with items |
| `GET` `PUT` `DELETE` | `/meals/:id` | Read / update (items reconciled by `id`) / delete |
| `GET` | `/diary?date=YYYY-MM-DD` | Entries and day totals |
| `POST` | `/diary/entries` | Log a meal or a single ingredient |
| `PUT` `DELETE` | `/diary/entries/:id` | Update amounts, date or position / delete |
| `GET` `POST` | `/weight` | List in a date range / upsert by date |
| `DELETE` | `/weight/:id` | Delete a weigh-in |
| `GET` `PUT` | `/settings` | Goal weight and preferred unit |

Errors share one envelope — `statusCode`, `error`, `message`, and an optional `details` object carrying machine-readable context such as the meals blocking an ingredient delete.

## How the domain works

**Nutrition is never stored as a total.** An ingredient defines calories and macros for a basis amount (100g, 100ml, or 1 unit) and everything else scales linearly from it. Meal totals, entry totals and day totals are all derived on read by `scaleNutrition` and `sumNutrition` in `packages/shared`, which are the only two places nutrition arithmetic happens.

**Diary entries are frozen at save time.** Each diary item stores a full copy of the ingredient it came from — name, basis amount, basis unit, and the five nutrition values. The `ingredientId` and `mealId` links are provenance only and are never read to compute nutrition, which gives three properties the test suite pins down:

- editing an ingredient never rewrites history;
- editing the amount on an old entry rescales from its own snapshot, not from today's values;
- deleting an ingredient or meal leaves past entries byte-for-byte unchanged.

A meal, by contrast, is a live template: its nutrition always reflects the current ingredient definitions.

**Dates are local calendar days** in `YYYY-MM-DD` form. The client sends its own local day and the server stores the string verbatim — nothing in the persistence path constructs a `Date`, so an entry logged at 23:30 in a non-UTC zone cannot land on the wrong day.

**Rounding is a rendering concern.** The API returns full precision and day totals are summed from unrounded values, so a rounded total can legitimately differ from the sum of the rounded rows above it. Use `roundNutrition` for display.

**Deletes are hard.** Deleting an ingredient a meal still uses is rejected with `409` and the list of meals; `?force=true` strips it from those meals and deletes any meal left with no items, reporting both lists in the response.

## Stack

Fastify 5, TypeScript, SQLite through Drizzle ORM and `better-sqlite3`, Zod for validation via `fastify-type-provider-zod`, `@fastify/swagger` for the OpenAPI document, Vitest for tests. The frontend is React + Vite with React Router, Recharts for the weight chart, and Tailwind CSS.
