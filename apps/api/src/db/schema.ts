import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * No createdAt / updatedAt / deletedAt columns anywhere: `position` is the only ordering key
 * and deletes are hard. Diary rows carry their own ingredient snapshot, so history survives
 * any edit or delete of the library it was created from.
 */

export const ingredients = sqliteTable('ingredients', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  basisAmount: real('basis_amount').notNull(),
  basisUnit: text('basis_unit', { enum: ['g', 'ml', 'unit'] }).notNull(),
  calories: real('calories').notNull(),
  protein: real('protein').notNull(),
  carbs: real('carbs').notNull(),
  fat: real('fat').notNull(),
  fiber: real('fiber').notNull(),
  notes: text('notes'),
});

export const meals = sqliteTable('meals', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  notes: text('notes'),
});

export const mealItems = sqliteTable(
  'meal_items',
  {
    id: text('id').primaryKey(),
    mealId: text('meal_id')
      .notNull()
      .references(() => meals.id, { onDelete: 'cascade' }),
    // RESTRICT is what produces the 409 when deleting an ingredient a meal still uses.
    ingredientId: text('ingredient_id')
      .notNull()
      .references(() => ingredients.id, { onDelete: 'restrict' }),
    defaultAmount: real('default_amount').notNull(),
    position: integer('position').notNull(),
  },
  (table) => ({
    mealPositionIdx: index('meal_items_meal_id_position_idx').on(table.mealId, table.position),
    ingredientIdx: index('meal_items_ingredient_id_idx').on(table.ingredientId),
  }),
);

export const diaryEntries = sqliteTable(
  'diary_entries',
  {
    id: text('id').primaryKey(),
    date: text('date').notNull(),
    position: integer('position').notNull(),
    type: text('type', { enum: ['meal', 'ingredient'] }).notNull(),
    mealId: text('meal_id').references(() => meals.id, { onDelete: 'set null' }),
    mealName: text('meal_name'),
  },
  (table) => ({
    datePositionIdx: index('diary_entries_date_position_idx').on(table.date, table.position),
  }),
);

export const diaryEntryItems = sqliteTable(
  'diary_entry_items',
  {
    id: text('id').primaryKey(),
    diaryEntryId: text('diary_entry_id')
      .notNull()
      .references(() => diaryEntries.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    ingredientId: text('ingredient_id').references(() => ingredients.id, { onDelete: 'set null' }),
    ingredientName: text('ingredient_name').notNull(),
    basisAmount: real('basis_amount').notNull(),
    basisUnit: text('basis_unit', { enum: ['g', 'ml', 'unit'] }).notNull(),
    basisCalories: real('basis_calories').notNull(),
    basisProtein: real('basis_protein').notNull(),
    basisCarbs: real('basis_carbs').notNull(),
    basisFat: real('basis_fat').notNull(),
    basisFiber: real('basis_fiber').notNull(),
    amount: real('amount').notNull(),
  },
  (table) => ({
    entryPositionIdx: index('diary_entry_items_entry_id_position_idx').on(
      table.diaryEntryId,
      table.position,
    ),
  }),
);

export const weightEntries = sqliteTable(
  'weight_entries',
  {
    id: text('id').primaryKey(),
    date: text('date').notNull(),
    weightKg: real('weight_kg').notNull(),
    notes: text('notes'),
  },
  (table) => ({
    dateIdx: uniqueIndex('weight_entries_date_idx').on(table.date),
  }),
);

export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey(),
  goalWeightKg: real('goal_weight_kg'),
  preferredUnit: text('preferred_unit', { enum: ['kg', 'lb'] })
    .notNull()
    .default('kg'),
});

export type IngredientRow = typeof ingredients.$inferSelect;
export type MealRow = typeof meals.$inferSelect;
export type MealItemRow = typeof mealItems.$inferSelect;
export type DiaryEntryRow = typeof diaryEntries.$inferSelect;
export type DiaryEntryItemRow = typeof diaryEntryItems.$inferSelect;
export type WeightEntryRow = typeof weightEntries.$inferSelect;
export type SettingsRow = typeof settings.$inferSelect;
