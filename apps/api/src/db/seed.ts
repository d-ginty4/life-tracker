import { loadConfig } from '../config.js';
import { createEntry } from '../services/diary.js';
import { createIngredient, listIngredients } from '../services/ingredients.js';
import { createMeal } from '../services/meals.js';
import { updateSettings } from '../services/settings.js';
import { upsertWeightEntry } from '../services/weight.js';
import { createDatabase, runMigrations } from './client.js';

/** Loads the worked example from DESIGN.md so a fresh database has something to look at. */
const config = loadConfig();
const { db, close } = createDatabase(config.databaseUrl);
runMigrations(db, config.migrationsFolder);

try {
  if (listIngredients(db).length > 0) {
    console.log('Database already has ingredients — nothing seeded.');
    process.exit(0);
  }

  const pasta = createIngredient(db, {
    name: 'Pasta (dry)',
    basisAmount: 100,
    basisUnit: 'g',
    calories: 350,
    protein: 12,
    carbs: 70,
    fat: 1.5,
    fiber: 3,
    notes: null,
  });

  const sauce = createIngredient(db, {
    name: 'Tomato sauce',
    basisAmount: 100,
    basisUnit: 'g',
    calories: 40,
    protein: 1,
    carbs: 8,
    fat: 0.5,
    fiber: 1.5,
    notes: null,
  });

  const parmesan = createIngredient(db, {
    name: 'Parmesan slice',
    basisAmount: 1,
    basisUnit: 'unit',
    calories: 40,
    protein: 4,
    carbs: 0,
    fat: 3,
    fiber: 0,
    notes: null,
  });

  const egg = createIngredient(db, {
    name: 'Egg',
    basisAmount: 1,
    basisUnit: 'unit',
    calories: 72,
    protein: 6.3,
    carbs: 0.4,
    fat: 4.8,
    fiber: 0,
    notes: 'Large egg',
  });

  const meal = createMeal(db, {
    name: 'Pasta dish',
    notes: null,
    items: [
      { ingredientId: pasta.id, defaultAmount: 100 },
      { ingredientId: sauce.id, defaultAmount: 120 },
      { ingredientId: parmesan.id, defaultAmount: 1 },
    ],
  });

  const date = '2026-08-10';
  const pastaItem = meal.items.find((item) => item.ingredientId === pasta.id);

  createEntry(db, {
    date,
    type: 'meal',
    mealId: meal.id,
    items: pastaItem ? [{ mealItemId: pastaItem.id, amount: 75 }] : [],
  });

  createEntry(db, { date, type: 'ingredient', ingredientId: egg.id, amount: 2 });

  upsertWeightEntry(db, { date, weightKg: 78.2, notes: null });
  updateSettings(db, { goalWeightKg: 75, preferredUnit: 'kg' });

  console.log(`Seeded 4 ingredients, 1 meal, a diary day (${date}) and a weigh-in.`);
} finally {
  close();
}
