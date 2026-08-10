import { randomUUID } from 'node:crypto';
import { eq, inArray, sql } from 'drizzle-orm';
import type { BasisUnit, Ingredient } from '@health-tracker/shared';
import type { AppDatabase, Db } from '../db/client.js';
import { ingredients, mealItems, meals, type IngredientRow } from '../db/schema.js';
import { conflict, notFound } from '../errors.js';

export type IngredientInput = {
  name: string;
  basisAmount: number;
  basisUnit: BasisUnit;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  notes: string | null;
};

export type MealRef = { id: string; name: string };

export type IngredientDeleteResult = {
  deleted: true;
  removedFromMeals: MealRef[];
  deletedMeals: MealRef[];
};

export function toIngredient(row: IngredientRow): Ingredient {
  return {
    id: row.id,
    name: row.name,
    basisAmount: row.basisAmount,
    basisUnit: row.basisUnit,
    calories: row.calories,
    protein: row.protein,
    carbs: row.carbs,
    fat: row.fat,
    fiber: row.fiber,
    notes: row.notes,
  };
}

export function listIngredients(db: Db): Ingredient[] {
  return db
    .select()
    .from(ingredients)
    .orderBy(sql`${ingredients.name} collate nocase`)
    .all()
    .map(toIngredient);
}

export function findIngredientRow(db: Db, id: string): IngredientRow | undefined {
  return db.select().from(ingredients).where(eq(ingredients.id, id)).get();
}

export function getIngredient(db: Db, id: string): Ingredient {
  const row = findIngredientRow(db, id);
  if (!row) throw notFound('Ingredient', id);
  return toIngredient(row);
}

export function createIngredient(db: Db, input: IngredientInput): Ingredient {
  const row: IngredientRow = { id: randomUUID(), ...input };
  db.insert(ingredients).values(row).run();
  return toIngredient(row);
}

export function updateIngredient(db: Db, id: string, input: IngredientInput): Ingredient {
  const existing = findIngredientRow(db, id);
  if (!existing) throw notFound('Ingredient', id);

  db.update(ingredients).set(input).where(eq(ingredients.id, id)).run();
  return toIngredient({ ...existing, ...input });
}

function mealsUsingIngredient(db: Db, ingredientId: string): MealRef[] {
  return db
    .selectDistinct({ id: meals.id, name: meals.name })
    .from(mealItems)
    .innerJoin(meals, eq(mealItems.mealId, meals.id))
    .where(eq(mealItems.ingredientId, ingredientId))
    .orderBy(meals.name)
    .all();
}

function renumberMealItems(db: Db, mealId: string): void {
  const rows = db
    .select({ id: mealItems.id })
    .from(mealItems)
    .where(eq(mealItems.mealId, mealId))
    .orderBy(mealItems.position)
    .all();

  rows.forEach((row, index) => {
    db.update(mealItems).set({ position: index }).where(eq(mealItems.id, row.id)).run();
  });
}

/**
 * Diary entries never block a delete: their ingredient snapshots make them self-contained, and
 * the `SET NULL` foreign key only drops the provenance link.
 */
export function deleteIngredient(db: AppDatabase, id: string, force: boolean): IngredientDeleteResult {
  return db.transaction((tx): IngredientDeleteResult => {
    const existing = findIngredientRow(tx, id);
    if (!existing) throw notFound('Ingredient', id);

    const referencing = mealsUsingIngredient(tx, id);
    if (referencing.length > 0 && !force) {
      throw conflict(
        `Ingredient '${existing.name}' is used by ${referencing.length} meal(s). Retry with ?force=true to remove it from them.`,
        { meals: referencing },
      );
    }

    const removedFromMeals: MealRef[] = [];
    const deletedMeals: MealRef[] = [];

    if (referencing.length > 0) {
      tx.delete(mealItems).where(eq(mealItems.ingredientId, id)).run();

      const stillPopulated = new Set(
        tx
          .select({ mealId: mealItems.mealId })
          .from(mealItems)
          .where(
            inArray(
              mealItems.mealId,
              referencing.map((meal) => meal.id),
            ),
          )
          .groupBy(mealItems.mealId)
          .all()
          .map((row) => row.mealId),
      );

      for (const meal of referencing) {
        if (stillPopulated.has(meal.id)) removedFromMeals.push(meal);
        else deletedMeals.push(meal);
      }

      if (deletedMeals.length > 0) {
        tx.delete(meals)
          .where(
            inArray(
              meals.id,
              deletedMeals.map((meal) => meal.id),
            ),
          )
          .run();
      }

      for (const meal of removedFromMeals) {
        renumberMealItems(tx, meal.id);
      }
    }

    tx.delete(ingredients).where(eq(ingredients.id, id)).run();

    return { deleted: true, removedFromMeals, deletedMeals };
  });
}
