import { randomUUID } from 'node:crypto';
import { eq, inArray, sql } from 'drizzle-orm';
import {
  scaleNutrition,
  sumNutrition,
  type Meal,
  type MealItem,
  type NutritionBasis,
} from '@health-tracker/shared';
import type { AppDatabase, Db } from '../db/client.js';
import { ingredients, mealItems, meals, type IngredientRow, type MealRow } from '../db/schema.js';
import { badRequest, notFound } from '../errors.js';

export type MealItemInput = { id?: string; ingredientId: string; defaultAmount: number };

export type MealInput = { name: string; notes: string | null; items: MealItemInput[] };

export function basisOf(ingredient: IngredientRow): NutritionBasis {
  return {
    basisAmount: ingredient.basisAmount,
    basisUnit: ingredient.basisUnit,
    basis: {
      calories: ingredient.calories,
      protein: ingredient.protein,
      carbs: ingredient.carbs,
      fat: ingredient.fat,
      fiber: ingredient.fiber,
    },
  };
}

function assertIngredientsExist(db: Db, ingredientIds: string[]): void {
  const unique = [...new Set(ingredientIds)];
  if (unique.length === 0) return;

  const found = new Set(
    db
      .select({ id: ingredients.id })
      .from(ingredients)
      .where(inArray(ingredients.id, unique))
      .all()
      .map((row) => row.id),
  );

  const missing = unique.filter((id) => !found.has(id));
  if (missing.length > 0) {
    throw badRequest(`Unknown ingredient id(s): ${missing.join(', ')}`, { missingIngredientIds: missing });
  }
}

/**
 * A meal is a live template: its nutrition always reflects today's ingredient definitions,
 * unlike a diary entry, which is frozen at save time.
 */
function buildMeals(db: Db, mealRows: MealRow[]): Meal[] {
  if (mealRows.length === 0) return [];

  const rows = db
    .select({ item: mealItems, ingredient: ingredients })
    .from(mealItems)
    .innerJoin(ingredients, eq(mealItems.ingredientId, ingredients.id))
    .where(
      inArray(
        mealItems.mealId,
        mealRows.map((meal) => meal.id),
      ),
    )
    .orderBy(mealItems.mealId, mealItems.position)
    .all();

  const itemsByMeal = new Map<string, { item: MealItem; nutrition: ReturnType<typeof scaleNutrition> }[]>();
  for (const { item, ingredient } of rows) {
    const bucket = itemsByMeal.get(item.mealId) ?? [];
    bucket.push({
      item: {
        id: item.id,
        position: item.position,
        ingredientId: item.ingredientId,
        ingredientName: ingredient.name,
        basisUnit: ingredient.basisUnit,
        defaultAmount: item.defaultAmount,
      },
      nutrition: scaleNutrition(basisOf(ingredient), item.defaultAmount),
    });
    itemsByMeal.set(item.mealId, bucket);
  }

  return mealRows.map((meal) => {
    const entries = itemsByMeal.get(meal.id) ?? [];
    return {
      id: meal.id,
      name: meal.name,
      notes: meal.notes,
      items: entries.map((entry) => entry.item),
      nutrition: sumNutrition(entries.map((entry) => entry.nutrition)),
    };
  });
}

export function listMeals(db: Db): Meal[] {
  const rows = db
    .select()
    .from(meals)
    .orderBy(sql`${meals.name} collate nocase`)
    .all();
  return buildMeals(db, rows);
}

export function findMealRow(db: Db, id: string): MealRow | undefined {
  return db.select().from(meals).where(eq(meals.id, id)).get();
}

export function getMeal(db: Db, id: string): Meal {
  const row = findMealRow(db, id);
  if (!row) throw notFound('Meal', id);
  const [meal] = buildMeals(db, [row]);
  if (!meal) throw notFound('Meal', id);
  return meal;
}

export function createMeal(db: AppDatabase, input: MealInput): Meal {
  return db.transaction((tx): Meal => {
    assertIngredientsExist(
      tx,
      input.items.map((item) => item.ingredientId),
    );

    const mealId = randomUUID();
    tx.insert(meals).values({ id: mealId, name: input.name, notes: input.notes }).run();
    tx.insert(mealItems)
      .values(
        input.items.map((item, position) => ({
          id: randomUUID(),
          mealId,
          ingredientId: item.ingredientId,
          defaultAmount: item.defaultAmount,
          position,
        })),
      )
      .run();

    return getMeal(tx, mealId);
  });
}

/** Items with an `id` are updated, items without one are created, and omitted items are deleted. */
export function updateMeal(db: AppDatabase, id: string, input: MealInput): Meal {
  return db.transaction((tx): Meal => {
    const existingMeal = findMealRow(tx, id);
    if (!existingMeal) throw notFound('Meal', id);

    assertIngredientsExist(
      tx,
      input.items.map((item) => item.ingredientId),
    );

    const existingIds = new Set(
      tx
        .select({ id: mealItems.id })
        .from(mealItems)
        .where(eq(mealItems.mealId, id))
        .all()
        .map((row) => row.id),
    );

    const keptIds = input.items.map((item) => item.id).filter((itemId): itemId is string => Boolean(itemId));
    const foreign = keptIds.filter((itemId) => !existingIds.has(itemId));
    if (foreign.length > 0) {
      throw badRequest(`Meal item id(s) do not belong to meal '${id}': ${foreign.join(', ')}`, {
        unknownItemIds: foreign,
      });
    }
    if (new Set(keptIds).size !== keptIds.length) {
      throw badRequest('Meal item ids must be unique within a meal');
    }

    const keptIdSet = new Set(keptIds);
    for (const existingId of existingIds) {
      if (!keptIdSet.has(existingId)) {
        tx.delete(mealItems).where(eq(mealItems.id, existingId)).run();
      }
    }

    tx.update(meals).set({ name: input.name, notes: input.notes }).where(eq(meals.id, id)).run();

    input.items.forEach((item, position) => {
      if (item.id) {
        tx.update(mealItems)
          .set({ ingredientId: item.ingredientId, defaultAmount: item.defaultAmount, position })
          .where(eq(mealItems.id, item.id))
          .run();
      } else {
        tx.insert(mealItems)
          .values({
            id: randomUUID(),
            mealId: id,
            ingredientId: item.ingredientId,
            defaultAmount: item.defaultAmount,
            position,
          })
          .run();
      }
    });

    return getMeal(tx, id);
  });
}

/** Diary entries that came from this meal keep their snapshots; only `mealId` is nulled out. */
export function deleteMeal(db: Db, id: string): void {
  const existing = findMealRow(db, id);
  if (!existing) throw notFound('Meal', id);
  db.delete(meals).where(eq(meals.id, id)).run();
}
