import { randomUUID } from 'node:crypto';
import { and, eq, inArray, ne, sql } from 'drizzle-orm';
import {
  scaleNutrition,
  sumNutrition,
  type DiaryDay,
  type DiaryEntry,
  type DiaryEntryItem,
} from '@health-tracker/shared';
import type { AppDatabase, Db } from '../db/client.js';
import {
  diaryEntries,
  diaryEntryItems,
  ingredients,
  mealItems,
  type DiaryEntryItemRow,
  type DiaryEntryRow,
} from '../db/schema.js';
import { badRequest, notFound } from '../errors.js';
import { findIngredientRow } from './ingredients.js';
import { findMealRow } from './meals.js';

export type CreateMealEntryInput = {
  date: string;
  type: 'meal';
  mealId: string;
  items: { mealItemId: string; amount: number }[];
};

export type CreateIngredientEntryInput = {
  date: string;
  type: 'ingredient';
  ingredientId: string;
  amount: number;
};

export type CreateEntryInput = CreateMealEntryInput | CreateIngredientEntryInput;

export type UpdateEntryInput = {
  date?: string;
  position?: number;
  items?: { id: string; amount: number }[];
};

function toItem(row: DiaryEntryItemRow): DiaryEntryItem {
  const basis = {
    basisAmount: row.basisAmount,
    basisUnit: row.basisUnit,
    basis: {
      calories: row.basisCalories,
      protein: row.basisProtein,
      carbs: row.basisCarbs,
      fat: row.basisFat,
      fiber: row.basisFiber,
    },
  };

  return {
    id: row.id,
    position: row.position,
    ingredientId: row.ingredientId,
    ingredientName: row.ingredientName,
    basisAmount: basis.basisAmount,
    basisUnit: basis.basisUnit,
    basis: basis.basis,
    amount: row.amount,
    // Always derived from the snapshot, never from the live ingredient.
    nutrition: scaleNutrition(basis, row.amount),
  };
}

function toEntry(row: DiaryEntryRow, itemRows: DiaryEntryItemRow[]): DiaryEntry {
  const items = itemRows.map(toItem);
  const name = row.type === 'meal' ? (row.mealName ?? '') : (items[0]?.ingredientName ?? '');

  return {
    id: row.id,
    date: row.date,
    position: row.position,
    type: row.type,
    name,
    mealId: row.mealId,
    items,
    nutrition: sumNutrition(items.map((item) => item.nutrition)),
  };
}

function itemRowsFor(db: Db, entryIds: string[]): Map<string, DiaryEntryItemRow[]> {
  const byEntry = new Map<string, DiaryEntryItemRow[]>();
  if (entryIds.length === 0) return byEntry;

  const rows = db
    .select()
    .from(diaryEntryItems)
    .where(inArray(diaryEntryItems.diaryEntryId, entryIds))
    .orderBy(diaryEntryItems.diaryEntryId, diaryEntryItems.position)
    .all();

  for (const row of rows) {
    const bucket = byEntry.get(row.diaryEntryId) ?? [];
    bucket.push(row);
    byEntry.set(row.diaryEntryId, bucket);
  }
  return byEntry;
}

function findEntryRow(db: Db, id: string): DiaryEntryRow | undefined {
  return db.select().from(diaryEntries).where(eq(diaryEntries.id, id)).get();
}

export function getEntry(db: Db, id: string): DiaryEntry {
  const row = findEntryRow(db, id);
  if (!row) throw notFound('Diary entry', id);
  const items = itemRowsFor(db, [id]).get(id) ?? [];
  return toEntry(row, items);
}

export function getDay(db: Db, date: string): DiaryDay {
  const rows = db
    .select()
    .from(diaryEntries)
    .where(eq(diaryEntries.date, date))
    .orderBy(diaryEntries.position)
    .all();

  const itemsByEntry = itemRowsFor(
    db,
    rows.map((row) => row.id),
  );
  const entries = rows.map((row) => toEntry(row, itemsByEntry.get(row.id) ?? []));

  return {
    date,
    entries,
    // Summed from unrounded values, so this can differ from the sum of the rounded rows on screen.
    totals: sumNutrition(entries.map((entry) => entry.nutrition)),
  };
}

function nextPosition(db: Db, date: string): number {
  const row = db
    .select({ next: sql<number>`coalesce(max(${diaryEntries.position}), -1) + 1` })
    .from(diaryEntries)
    .where(eq(diaryEntries.date, date))
    .get();
  return row?.next ?? 0;
}

type ItemSnapshot = Omit<DiaryEntryItemRow, 'id' | 'diaryEntryId'>;

function snapshotOfIngredient(
  ingredient: NonNullable<ReturnType<typeof findIngredientRow>>,
  position: number,
  amount: number,
): ItemSnapshot {
  return {
    position,
    ingredientId: ingredient.id,
    ingredientName: ingredient.name,
    basisAmount: ingredient.basisAmount,
    basisUnit: ingredient.basisUnit,
    basisCalories: ingredient.calories,
    basisProtein: ingredient.protein,
    basisCarbs: ingredient.carbs,
    basisFat: ingredient.fat,
    basisFiber: ingredient.fiber,
    amount,
  };
}

/**
 * Ingredient snapshots are frozen here and nowhere else. Once an entry exists it is
 * self-contained: later edits rescale from these values instead of re-reading the library.
 */
export function createEntry(db: AppDatabase, input: CreateEntryInput): DiaryEntry {
  return db.transaction((tx): DiaryEntry => {
    const entryId = randomUUID();
    let snapshots: ItemSnapshot[];
    let mealName: string | null = null;
    let mealId: string | null = null;

    if (input.type === 'meal') {
      const meal = findMealRow(tx, input.mealId);
      if (!meal) throw notFound('Meal', input.mealId);

      const rows = tx
        .select({ item: mealItems, ingredient: ingredients })
        .from(mealItems)
        .innerJoin(ingredients, eq(mealItems.ingredientId, ingredients.id))
        .where(eq(mealItems.mealId, meal.id))
        .orderBy(mealItems.position)
        .all();

      if (rows.length === 0) {
        throw badRequest(`Meal '${meal.id}' has no items to log`);
      }

      const overrides = new Map<string, number>();
      for (const override of input.items) {
        if (overrides.has(override.mealItemId)) {
          throw badRequest(`Duplicate override for meal item '${override.mealItemId}'`);
        }
        overrides.set(override.mealItemId, override.amount);
      }

      const known = new Set(rows.map((row) => row.item.id));
      const foreign = [...overrides.keys()].filter((itemId) => !known.has(itemId));
      if (foreign.length > 0) {
        throw badRequest(`Meal item id(s) do not belong to meal '${meal.id}': ${foreign.join(', ')}`, {
          unknownMealItemIds: foreign,
        });
      }

      mealId = meal.id;
      mealName = meal.name;
      snapshots = rows.map(({ item, ingredient }, position) =>
        snapshotOfIngredient(ingredient, position, overrides.get(item.id) ?? item.defaultAmount),
      );
    } else {
      const ingredient = findIngredientRow(tx, input.ingredientId);
      if (!ingredient) throw notFound('Ingredient', input.ingredientId);
      snapshots = [snapshotOfIngredient(ingredient, 0, input.amount)];
    }

    tx.insert(diaryEntries)
      .values({
        id: entryId,
        date: input.date,
        position: nextPosition(tx, input.date),
        type: input.type,
        mealId,
        mealName,
      })
      .run();

    tx.insert(diaryEntryItems)
      .values(snapshots.map((snapshot) => ({ id: randomUUID(), diaryEntryId: entryId, ...snapshot })))
      .run();

    return getEntry(tx, entryId);
  });
}

function renumberDay(db: Db, date: string): void {
  const rows = db
    .select({ id: diaryEntries.id })
    .from(diaryEntries)
    .where(eq(diaryEntries.date, date))
    .orderBy(diaryEntries.position)
    .all();

  rows.forEach((row, position) => {
    db.update(diaryEntries).set({ position }).where(eq(diaryEntries.id, row.id)).run();
  });
}

function reposition(db: Db, entry: DiaryEntryRow, targetDate: string, requestedPosition?: number): void {
  const siblings = db
    .select({ id: diaryEntries.id })
    .from(diaryEntries)
    .where(and(eq(diaryEntries.date, targetDate), ne(diaryEntries.id, entry.id)))
    .orderBy(diaryEntries.position)
    .all()
    .map((row) => row.id);

  const fallback = targetDate === entry.date ? Math.min(entry.position, siblings.length) : siblings.length;
  const index = Math.max(0, Math.min(requestedPosition ?? fallback, siblings.length));

  const ordered = [...siblings.slice(0, index), entry.id, ...siblings.slice(index)];

  db.update(diaryEntries).set({ date: targetDate }).where(eq(diaryEntries.id, entry.id)).run();
  ordered.forEach((id, position) => {
    db.update(diaryEntries).set({ position }).where(eq(diaryEntries.id, id)).run();
  });

  if (targetDate !== entry.date) renumberDay(db, entry.date);
}

/** Amounts rescale from the stored snapshot; items can never be added or removed. */
export function updateEntry(db: AppDatabase, id: string, input: UpdateEntryInput): DiaryEntry {
  return db.transaction((tx): DiaryEntry => {
    const entry = findEntryRow(tx, id);
    if (!entry) throw notFound('Diary entry', id);

    if (input.items) {
      const existingIds = new Set((itemRowsFor(tx, [id]).get(id) ?? []).map((row) => row.id));
      const seen = new Set<string>();

      for (const item of input.items) {
        if (!existingIds.has(item.id)) {
          throw badRequest(`Item '${item.id}' does not belong to diary entry '${id}'`, {
            unknownItemIds: [item.id],
          });
        }
        if (seen.has(item.id)) throw badRequest(`Duplicate update for item '${item.id}'`);
        seen.add(item.id);
      }

      for (const item of input.items) {
        tx.update(diaryEntryItems)
          .set({ amount: item.amount })
          .where(eq(diaryEntryItems.id, item.id))
          .run();
      }
    }

    const targetDate = input.date ?? entry.date;
    if (targetDate !== entry.date || input.position !== undefined) {
      reposition(tx, entry, targetDate, input.position);
    }

    return getEntry(tx, id);
  });
}

export function deleteEntry(db: AppDatabase, id: string): void {
  db.transaction((tx) => {
    const entry = findEntryRow(tx, id);
    if (!entry) throw notFound('Diary entry', id);

    tx.delete(diaryEntries).where(eq(diaryEntries.id, id)).run();
    renumberDay(tx, entry.date);
  });
}
