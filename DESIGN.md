# Health Tracker — Design Document

## Overview

A personal, web-based health tracker for one user: log daily calories/macros and record body weight over time. Build a reusable library of **ingredients** (manual nutrition entry per a defined basis), compose them into **meals**, log daily intake by selecting meals or individual ingredients (with adjustable amounts), and track weight progress against a **goal weight**.

v1 is a private app for personal use only. All food data is entered manually — no external food databases, barcode scanning, or third-party nutrition APIs.

---

## v1 Goals

- Personal single-user web app (manual ingredient/meal entry only).
- Fast daily logging: log a whole meal quickly, with amount overrides when portions differ from defaults.
- Accurate nutrition math: calories and macros always scale linearly from ingredient baselines.
- Clear weight progress: line chart of weigh-ins with a visible goal weight.
- Weight target only — no daily calorie goal in v1.

## Non-goals (v1)

- Multi-user accounts / social features
- External food databases, barcode scanning, or nutrition API imports
- Daily calorie / macro goals or TDEE calculators
- Workout / step tracking
- Native mobile apps (responsive web only)

---

## Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Frontend | React + TypeScript (Vite) | Typed UI; shares domain types with the API |
| Backend | TypeScript (Node.js + Fastify) | Same language as frontend → shared types/validation for nutrition scaling |
| Database | SQLite (via Prisma or Drizzle) | Zero ops for a personal app; easy local backups |
| Charts | Recharts | Simple line charts for weight progress |
| Styling | CSS Modules or Tailwind | Lean UI; no heavy component library required for v1 |

Shared TypeScript types and nutrition helpers live in a `packages/shared` package used by both web and API.

### Suggested repo layout

```
health-tracker/
├── DESIGN.md
├── apps/
│   ├── web/                 # React + Vite frontend
│   └── api/                 # Fastify + TypeScript API
├── packages/
│   └── shared/              # Shared types, Zod schemas, nutrition helpers
└── README.md
```

---

## Core Concepts

### 1. Ingredient

A reusable food item with nutrition defined for a specific **basis amount**. Created and updated by hand only.

| Field | Description |
|-------|-------------|
| `id` | Unique identifier |
| `name` | e.g. "Eggs", "Whole milk", "Pasta (dry)" |
| `basisAmount` | Numeric amount the macros apply to (typically `100` or `1`) |
| `basisUnit` | `g` \| `ml` \| `unit` |
| `calories` | kcal for the basis amount |
| `protein` | grams for the basis amount |
| `carbs` | grams for the basis amount |
| `fat` | grams for the basis amount |
| `fiber` | grams for the basis amount |
| `notes` | Optional free text |

**Unit conventions**

| Unit | Typical basis | Examples |
|------|---------------|----------|
| `g` | 100 | Pasta, chicken, cheese (by weight) |
| `ml` | 100 | Milk, oil, juice |
| `unit` | 1 | Egg, slice of bread, slice of cheese |

**Scaling formula**

When logging quantity `q` of an ingredient:

```
factor = q / basisAmount
calories = ingredient.calories * factor
protein  = ingredient.protein  * factor
carbs    = ingredient.carbs    * factor
fat      = ingredient.fat      * factor
fiber    = ingredient.fiber    * factor
```

Example: pasta is 350 kcal / 100g. Logging 75g → factor `0.75` → 262.5 kcal.

### 2. Meal

A reusable collection of ingredients with default quantities. Meal nutrition is the **sum** of its scaled ingredients (computed, not authored independently).

| Field | Description |
|-------|-------------|
| `id` | Unique identifier |
| `name` | e.g. "Pasta dish", "Breakfast bowl" |
| `items` | Ordered list of `{ id, ingredientId, defaultAmount }` |
| `notes` | Optional |

Each meal item has its own `id`, so a meal can list the same ingredient more than once (two additions of oil, chicken in two forms) and amount overrides stay unambiguous.

Meal totals at default amounts:

```
mealMacros = Σ scale(ingredient_i, defaultAmount_i)
```

### 3. Daily log (food diary)

A day has many **log entries**, ordered by `position`. Every entry is a list of one or more **entry items**, whatever its type:

- **Meal entry**: one item per meal ingredient, amounts pre-filled from the meal defaults and editable before save.
- **Ingredient entry**: exactly one item.

`type` only decides how the entry is labelled — a meal entry is named after its meal, an ingredient entry after its single item. Both share one storage shape and one totalling rule.

**Each item stores a full snapshot of the ingredient it was created from**: name, basis amount, basis unit, and the five nutrition values for that basis. Nutrition is then always derived as `scale(snapshot, amount)` rather than read from the live ingredient, which gives three properties:

- Editing an ingredient definition never rewrites history.
- Editing the amount on an old entry rescales from the snapshot, so unrelated lines cannot silently drift to today's numbers.
- Deleting an ingredient or meal leaves past entries fully intact.

`ingredientId` and `mealId` survive on entries as provenance links only. They are set to `NULL` when the target is deleted, and are never read to compute nutrition.

### 4. Weight entry

A dated body-weight reading in kilograms.

### 5. Settings

Singleton preferences for the personal app. v1 stores only a **goal weight** (and display unit). No calorie goal.

---

## Conventions

### Dates

`date` is always a **local calendar day** string in `YYYY-MM-DD` form. The client sends the user's local day and the server stores it verbatim — no timezone parsing, no conversion to or from UTC, no `Date` objects in the persistence path. Without this rule an entry logged at 23:30 in a non-UTC zone lands on the wrong day.

There are no `createdAt` / `updatedAt` / `deletedAt` columns anywhere in the schema.

### Ordering

Diary entries within a day, meal items within a meal, and items within a diary entry are each ordered by an integer `position` starting at 0. New records get `max(position) + 1` within their parent. Since there is no creation timestamp, `position` is the only ordering key.

### Deletes

Deletes are hard. Because every diary item carries a full ingredient snapshot, deleting an ingredient or a meal cannot corrupt history:

| Delete | Effect |
|--------|--------|
| Ingredient referenced by a meal | Rejected with `409` listing the meals, unless `?force=true` |
| Ingredient referenced only by diary entries | Deleted; entries keep their snapshots, `ingredientId` becomes `null` |
| Meal | Deleted; diary entries keep their snapshotted meal name, `mealId` becomes `null` |
| Diary entry | Deleted along with its items |

`?force=true` on an ingredient delete also removes it from every meal that uses it, and deletes any meal left with zero items (meals must have at least one). The response reports both lists.

### Rounding

Store and compute at **full precision**; round only when rendering. Day totals are summed from unrounded values, so a rounded total may differ from the sum of the rounded rows shown above it — that is expected and preferable to accumulating rounding error into stored data. Display calories to 0 decimal places and macros to 1.

### Derived values

No nutrition totals are stored. A diary item's nutrition is derived from its snapshot and amount; an entry's total is the sum of its items; a day's total is the sum of its entries. The snapshots make these deterministic and stable over time, so there is nothing to keep in sync.

---

## JSON Models

These are the canonical shapes for API responses and shared TypeScript types.

### Shared nutrition

```json
{
  "calories": 350,
  "protein": 12,
  "carbs": 70,
  "fat": 1.5,
  "fiber": 3
}
```

### Ingredient

```json
{
  "id": "<uuid>",
  "name": "Pasta (dry)",
  "basisAmount": 100,
  "basisUnit": "g",
  "calories": 350,
  "protein": 12,
  "carbs": 70,
  "fat": 1.5,
  "fiber": 3,
  "notes": null
}
```

Liquid example (`basisUnit: "ml"`):

```json
{
  "id": "<uuid>",
  "name": "Whole milk",
  "basisAmount": 100,
  "basisUnit": "ml",
  "calories": 64,
  "protein": 3.3,
  "carbs": 4.8,
  "fat": 3.6,
  "fiber": 0,
  "notes": null
}
```

Per-unit example (`basisUnit: "unit"`):

```json
{
  "id": "<uuid>",
  "name": "Egg",
  "basisAmount": 1,
  "basisUnit": "unit",
  "calories": 72,
  "protein": 6.3,
  "carbs": 0.4,
  "fat": 4.8,
  "fiber": 0,
  "notes": "Large egg"
}
```

### Meal

```json
{
  "id": "<uuid>",
  "name": "Pasta dish",
  "notes": null,
  "items": [
    {
      "id": "<uuid>",
      "position": 0,
      "ingredientId": "<uuid>",
      "ingredientName": "Pasta (dry)",
      "basisUnit": "g",
      "defaultAmount": 100
    },
    {
      "id": "<uuid>",
      "position": 1,
      "ingredientId": "<uuid>",
      "ingredientName": "Tomato sauce",
      "basisUnit": "g",
      "defaultAmount": 120
    },
    {
      "id": "<uuid>",
      "position": 2,
      "ingredientId": "<uuid>",
      "ingredientName": "Parmesan slice",
      "basisUnit": "unit",
      "defaultAmount": 1
    }
  ],
  "nutrition": {
    "calories": 438,
    "protein": 17.2,
    "carbs": 79.6,
    "fat": 5.1,
    "fiber": 4.8
  }
}
```

`nutrition` is computed from current ingredient definitions at default amounts (response-only; not stored). Unlike diary entries, a meal is a live template — it always reflects today's ingredient values.

**Create / update meal request:**

```json
{
  "name": "Pasta dish",
  "notes": null,
  "items": [
    { "id": "<uuid>", "ingredientId": "<uuid>", "defaultAmount": 100 },
    { "ingredientId": "<uuid>", "defaultAmount": 120 },
    { "ingredientId": "<uuid>", "defaultAmount": 1 }
  ]
}
```

Item order in the request defines `position`. On update, items with an `id` are kept and updated, items without one are created, and any existing item whose `id` is absent from the list is deleted.

### Diary entry item

The unit both entry types are built from. `basisAmount`, `basisUnit` and `basis` are frozen copies of the ingredient as it was at save time; `nutrition` is `scale(basis, amount)`, derived on read.

```json
{
  "id": "<uuid>",
  "position": 0,
  "ingredientId": "<uuid>",
  "ingredientName": "Pasta (dry)",
  "basisAmount": 100,
  "basisUnit": "g",
  "basis": { "calories": 350, "protein": 12, "carbs": 70, "fat": 1.5, "fiber": 3 },
  "amount": 75,
  "nutrition": { "calories": 262.5, "protein": 9, "carbs": 52.5, "fat": 1.125, "fiber": 2.25 }
}
```

### Diary entry — meal

Logged with overridden pasta amount (75g instead of default 100g). Item snapshots are abbreviated below for readability:

```json
{
  "id": "<uuid>",
  "date": "2026-08-10",
  "position": 0,
  "type": "meal",
  "name": "Pasta dish",
  "mealId": "<uuid>",
  "items": [
    {
      "id": "<uuid>",
      "position": 0,
      "ingredientId": "<uuid>",
      "ingredientName": "Pasta (dry)",
      "basisAmount": 100,
      "basisUnit": "g",
      "basis": { "calories": 350, "protein": 12, "carbs": 70, "fat": 1.5, "fiber": 3 },
      "amount": 75,
      "nutrition": { "calories": 262.5, "protein": 9, "carbs": 52.5, "fat": 1.125, "fiber": 2.25 }
    },
    {
      "id": "<uuid>",
      "position": 1,
      "ingredientId": "<uuid>",
      "ingredientName": "Tomato sauce",
      "basisAmount": 100,
      "basisUnit": "g",
      "basis": { "calories": 40, "protein": 1, "carbs": 8, "fat": 0.5, "fiber": 1.5 },
      "amount": 120,
      "nutrition": { "calories": 48, "protein": 1.2, "carbs": 9.6, "fat": 0.6, "fiber": 1.8 }
    },
    {
      "id": "<uuid>",
      "position": 2,
      "ingredientId": "<uuid>",
      "ingredientName": "Parmesan slice",
      "basisAmount": 1,
      "basisUnit": "unit",
      "basis": { "calories": 40, "protein": 4, "carbs": 0, "fat": 3, "fiber": 0 },
      "amount": 1,
      "nutrition": { "calories": 40, "protein": 4, "carbs": 0, "fat": 3, "fiber": 0 }
    }
  ],
  "nutrition": {
    "calories": 350.5,
    "protein": 14.2,
    "carbs": 62.1,
    "fat": 4.725,
    "fiber": 4.05
  }
}
```

`name` is `mealName` for meal entries and the single item's `ingredientName` for ingredient entries, so the day list can render one field for both. `mealId` is `null` once the source meal is deleted; `name` is unaffected.

**Create meal diary entry request:**

Amounts are addressed by `mealItemId`, not `ingredientId`, so a meal listing the same ingredient twice stays unambiguous. Omitted items use the meal's `defaultAmount`; the server resolves each item against the meal and freezes the snapshot.

```json
{
  "date": "2026-08-10",
  "type": "meal",
  "mealId": "<uuid>",
  "items": [
    { "mealItemId": "<uuid>", "amount": 75 }
  ]
}
```

### Diary entry — single ingredient

Same shape, with exactly one item and no meal link:

```json
{
  "id": "<uuid>",
  "date": "2026-08-10",
  "position": 1,
  "type": "ingredient",
  "name": "Egg",
  "mealId": null,
  "items": [
    {
      "id": "<uuid>",
      "position": 0,
      "ingredientId": "<uuid>",
      "ingredientName": "Egg",
      "basisAmount": 1,
      "basisUnit": "unit",
      "basis": { "calories": 72, "protein": 6.3, "carbs": 0.4, "fat": 4.8, "fiber": 0 },
      "amount": 2,
      "nutrition": { "calories": 144, "protein": 12.6, "carbs": 0.8, "fat": 9.6, "fiber": 0 }
    }
  ],
  "nutrition": {
    "calories": 144,
    "protein": 12.6,
    "carbs": 0.8,
    "fat": 9.6,
    "fiber": 0
  }
}
```

**Create ingredient diary entry request:**

```json
{
  "date": "2026-08-10",
  "type": "ingredient",
  "ingredientId": "<uuid>",
  "amount": 2
}
```

**Update entry request:**

Items are addressed by their own `id` — the entry is self-contained after creation and never re-reads the meal or ingredient it came from. Amount changes rescale from the stored snapshot. Items cannot be added or removed; delete and re-log instead.

```json
{
  "date": "2026-08-10",
  "position": 0,
  "items": [
    { "id": "<uuid>", "amount": 90 }
  ]
}
```

### Diary day response

Entries are ordered by `position` and returned in full; the summary below elides `items` for brevity.

```json
{
  "date": "2026-08-10",
  "entries": [
    { "id": "<uuid>", "position": 0, "type": "meal", "name": "Pasta dish", "items": [], "nutrition": { "calories": 350.5, "protein": 14.2, "carbs": 62.1, "fat": 4.725, "fiber": 4.05 } },
    { "id": "<uuid>", "position": 1, "type": "ingredient", "name": "Egg", "items": [], "nutrition": { "calories": 144, "protein": 12.6, "carbs": 0.8, "fat": 9.6, "fiber": 0 } }
  ],
  "totals": {
    "calories": 494.5,
    "protein": 26.8,
    "carbs": 62.9,
    "fat": 14.325,
    "fiber": 4.05
  }
}
```

### Weight entry

```json
{
  "id": "<uuid>",
  "date": "2026-08-10",
  "weightKg": 78.2,
  "notes": null
}
```

**Create / upsert weight request:**

```json
{
  "date": "2026-08-10",
  "weightKg": 78.2,
  "notes": null
}
```

### Settings

```json
{
  "goalWeightKg": 75,
  "preferredUnit": "kg"
}
```

**Update settings request:**

```json
{
  "goalWeightKg": 75,
  "preferredUnit": "kg"
}
```

---

## User Flows

### Manage ingredients

1. Open Ingredients library.
2. Manually add ingredient: name, basis amount, unit, calories, protein, carbs, fat, fiber.
3. Edit freely — meals pick up the new values, past diary entries do not.
4. Delete. If any meal uses it, the UI lists them and offers to remove it from those meals (force delete); past diary entries are never affected either way.

### Manage meals

1. Open Meals library.
2. Create meal: name + add ingredients with default amounts.
3. UI shows live totals as ingredients are added.
4. Edit defaults anytime; existing log entries keep their snapshots.

### Log food for a day

1. Open Diary for today (or pick a date).
2. **Add meal**
   - Select meal → form shows each ingredient with default amounts.
   - Change any amount if needed (e.g. pasta 100g → 75g).
   - Preview updates live using the scaling formula.
   - Confirm → creates a meal log entry with per-item amounts + nutrition snapshot.
3. **Add ingredient**
   - Select ingredient → enter amount → preview → save.
4. Day summary shows total kcal, protein, carbs, fat, fiber for all entries (informational only — no calorie goal).

### Track weight

1. Open Weight section.
2. Enter today’s weight (or any date).
3. Set / edit goal weight.
4. Line chart: X = date, Y = weight; horizontal reference line for goal.

---

## API Design (REST)

Base path: `/api`

### Ingredients

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/ingredients` | List all |
| `POST` | `/ingredients` | Create |
| `GET` | `/ingredients/:id` | Get one |
| `PUT` | `/ingredients/:id` | Update |
| `DELETE` | `/ingredients/:id?force=` | Delete; `409` with referencing meals unless forced |

### Meals

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/meals` | List all (include items + computed default totals) |
| `POST` | `/meals` | Create with items |
| `GET` | `/meals/:id` | Get one |
| `PUT` | `/meals/:id` | Update (items reconciled by `id`) |
| `DELETE` | `/meals/:id` | Delete; past diary entries keep their snapshots |

### Diary

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/diary?date=YYYY-MM-DD` | Entries + day totals for date |
| `POST` | `/diary/entries` | Create meal or ingredient entry |
| `PUT` | `/diary/entries/:id` | Update amounts, date or position |
| `DELETE` | `/diary/entries/:id` | Remove entry and its items |

The server freezes ingredient snapshots onto entry items **at creation only**. Updates rescale from those snapshots and never re-read the ingredient or meal, so an edit to an old entry cannot pull in today's definitions.

### Weight & settings

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/weight?from=&to=` | List entries in range |
| `POST` | `/weight` | Upsert by date |
| `DELETE` | `/weight/:id` | Delete |
| `GET` | `/settings` | Goal weight + preferred unit |
| `PUT` | `/settings` | Update goal weight + preferred unit |

---

## Data Model (relational sketch)

```
Ingredient
  id, name, basis_amount, basis_unit, calories, protein, carbs, fat, fiber,
  notes

Meal
  id, name, notes

MealItem
  id, meal_id      -> Meal.id       ON DELETE CASCADE,
      ingredient_id -> Ingredient.id ON DELETE RESTRICT,
  default_amount, position
  INDEX (meal_id, position)

DiaryEntry
  id, date, position, type ('meal'|'ingredient'),
  meal_id   -> Meal.id ON DELETE SET NULL,  nullable
  meal_name nullable                        -- snapshot, set when type='meal'
  INDEX (date, position)

DiaryEntryItem                     -- one row per item, both entry types
  id, diary_entry_id -> DiaryEntry.id ON DELETE CASCADE, position,
  ingredient_id      -> Ingredient.id ON DELETE SET NULL,  nullable
  ingredient_name, basis_amount, basis_unit,               -- snapshot
  basis_calories, basis_protein, basis_carbs,
  basis_fat, basis_fiber,                                  -- snapshot
  amount

WeightEntry
  id, date UNIQUE, weight_kg, notes

Settings
  id (singleton), goal_weight_kg, preferred_unit
```

Notes on the foreign keys:

- `MealItem.ingredient_id` is `RESTRICT` — this is what produces the `409` on deleting a referenced ingredient. Force-delete removes the meal items in application code first.
- Both diary foreign keys are `SET NULL`. Nothing in the diary depends on them resolving, so hard deletes are always safe.
- No nutrition totals are stored on `DiaryEntry`. Everything derives from `DiaryEntryItem` snapshots.

---

## Frontend Structure

### Routes / sections

| Route | Purpose |
|-------|---------|
| `/` | Today’s diary summary + quick add |
| `/diary/:date?` | Day detail and logging |
| `/ingredients` | Ingredient library CRUD |
| `/meals` | Meal library CRUD |
| `/weight` | Weight log + chart + goal |

### Key UI behaviors

**Meal log amount override**

1. Select meal → open sheet/modal.
2. List each meal item by `mealItemId`: name, unit, editable amount (pre-filled with `defaultAmount`). The same ingredient may legitimately appear twice.
3. Show live recalculated line totals and meal total via `scaleNutrition`.
4. Save posts only the items whose amount was changed; the server fills the rest from the meal defaults.

**Diary day view**

- List of entries ordered by `position`, each showing `name`, kcal, macros.
- Header totals for the day (no goal/progress ring), summed from unrounded values.
- Date picker to navigate days; the date sent is the user's local day.
- Editing an entry reopens the same amount form, addressing items by their own `id`.

**Weight view**

- Form: date + weight + optional notes.
- Goal weight input (saved to settings).
- Line chart of weight over time with goal reference line.
- Default range: last 90 days (adjustable).

### Shared nutrition helpers (`packages/shared`)

```ts
type BasisUnit = 'g' | 'ml' | 'unit';

type Nutrition = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
};

/** The frozen part of an ingredient that a diary item copies at save time. */
type NutritionBasis = {
  basisAmount: number;      // > 0
  basisUnit: BasisUnit;
  basis: Nutrition;
};

/** Throws on basisAmount <= 0 or amount < 0. */
function scaleNutrition(source: NutritionBasis, amount: number): Nutrition;

function sumNutrition(parts: Nutrition[]): Nutrition;

/** Display only — never applied before storage. */
function roundNutrition(n: Nutrition): Nutrition;
```

`scaleNutrition` takes a `NutritionBasis` rather than an ingredient, which is what lets the same call serve a live preview (basis read from the ingredient library) and a stored diary item (basis read from the item's own snapshot). Both sides of the app compute nutrition through these three functions and nowhere else.

---

## Validation Rules

- `basisAmount` > 0 (on ingredients and on stored item snapshots)
- Macros (protein, carbs, fat, fiber) and calories ≥ 0
- Log / meal item `amount` > 0
- `basisUnit` must be one of `g`, `ml`, `unit`
- Meal must have ≥ 1 item, and a diary entry must have ≥ 1 item
- An `ingredient` diary entry must have exactly 1 item and a `null` `mealId`
- `mealItemId` on a create request must belong to the referenced `mealId`
- `date` must match `YYYY-MM-DD` and is never timezone-converted
- `position` is a non-negative integer, unique within its parent
- Weight > 0 and within a sane range (e.g. 20–400 kg) to catch typos
- One weight entry per date (upsert)
- `goalWeightKg` > 0 when set

Rounding is display-only — see [Conventions](#rounding). Nothing is ever rounded before storage.

---

## Example Walkthrough

1. **Create ingredients** (manual entry)
   - Pasta (dry): 100g → 350 kcal, P 12, C 70, F 1.5, Fiber 3
   - Tomato sauce: 100g → 40 kcal, P 1, C 8, F 0.5, Fiber 1.5
   - Parmesan: 1 unit (slice) → 40 kcal, P 4, C 0, F 3, Fiber 0
2. **Create meal “Pasta dish”**
   - Pasta 100g, sauce 120g, Parmesan 1 unit  
   - Defaults total ≈ 350 + 48 + 40 = 438 kcal
3. **Log today**
   - Select “Pasta dish”, change pasta to 75g  
   - Totals ≈ 262.5 + 48 + 40 = 350.5 kcal → saved on diary entry
4. **Also log** 2 eggs as a one-off ingredient entry
5. **Weight**
   - Goal 75 kg; log 78.2 kg → chart shows progress toward goal

---

## Out of scope / later

| Topic | v1 | Later (optional) |
|-------|----|------------------|
| Audience | Personal single-user web app | Multi-device auth if needed |
| Food data | Manual entry only | Still no requirement for external DBs |
| Goals | Goal weight only | Daily calorie goal if wanted |
| Units | kg; g / ml / unit | lb display conversion |

---

## Success Criteria

- Can manually create ingredients with g / ml / unit bases and correct scaled macros (including fiber).
- Can build meals from ingredients with default amounts and see summed nutrition (calories, protein, carbs, fat, fiber).
- Can log a meal for a day, override ingredient amounts, and see adjusted calories before and after save.
- Can log a single ingredient for a day.
- Can record weight, set a goal weight, and view a line graph of progress vs goal.
- Editing an ingredient, or deleting an ingredient or meal, leaves every past diary entry byte-for-byte unchanged.
- Editing the amount on an old diary entry rescales from its snapshot, not from current ingredient values.
- No calorie goal UI or settings in v1.
- Frontend and backend are both TypeScript.
