import { z } from 'zod';

/* ------------------------------------------------------------------ primitives */

export const idSchema = z.string().uuid().describe('UUID v4 identifier');

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/**
 * A local calendar day. Parsed digit-by-digit rather than via `Date` so that no part of the
 * stack can shift a day across a timezone boundary.
 */
function isCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const maxDay = month === 2 && isLeap ? 29 : (DAYS_IN_MONTH[month - 1] as number);
  return day <= maxDay;
}

export const dateSchema = z
  .string()
  .refine(isCalendarDate, { message: 'date must be a valid calendar day in YYYY-MM-DD form' })
  .describe('Local calendar day, YYYY-MM-DD. Never timezone-converted.');

export const basisUnitSchema = z.enum(['g', 'ml', 'unit']).describe('Unit the basis amount is expressed in');

export const preferredUnitSchema = z.enum(['kg', 'lb']);

export const positionSchema = z.number().int().min(0).describe('Order within the parent, starting at 0');

const positiveAmount = z.number().finite().positive();
const nonNegative = z.number().finite().min(0);

const nameSchema = z.string().trim().min(1).max(200);
const notesSchema = z.string().trim().max(2000).nullish().transform((value) => value ?? null);

export const nutritionSchema = z
  .object({
    calories: nonNegative,
    protein: nonNegative,
    carbs: nonNegative,
    fat: nonNegative,
    fiber: nonNegative,
  })
  .describe('Nutrition values at full precision — rounding is a rendering concern');

/* ---------------------------------------------------------------- ingredients */

export const ingredientSchema = z.object({
  id: idSchema,
  name: nameSchema,
  basisAmount: positiveAmount.describe('Amount the nutrition values apply to, e.g. 100'),
  basisUnit: basisUnitSchema,
  calories: nonNegative,
  protein: nonNegative,
  carbs: nonNegative,
  fat: nonNegative,
  fiber: nonNegative,
  notes: z.string().nullable(),
});

export const ingredientInputSchema = z.object({
  name: nameSchema,
  basisAmount: positiveAmount,
  basisUnit: basisUnitSchema,
  calories: nonNegative,
  protein: nonNegative,
  carbs: nonNegative,
  fat: nonNegative,
  fiber: nonNegative,
  notes: notesSchema.default(null),
});

export const ingredientListSchema = z.array(ingredientSchema);

export const mealRefSchema = z.object({ id: idSchema, name: z.string() });

export const ingredientDeleteQuerySchema = z.object({
  force: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true')
    .describe('Also strip the ingredient from any meal that uses it'),
});

export const ingredientDeleteResultSchema = z.object({
  deleted: z.literal(true),
  removedFromMeals: z
    .array(mealRefSchema)
    .describe('Meals that survived with the ingredient stripped out of them'),
  deletedMeals: z.array(mealRefSchema).describe('Meals deleted because they were left with no items'),
});

/* ---------------------------------------------------------------------- meals */

export const mealItemSchema = z.object({
  id: idSchema,
  position: positionSchema,
  ingredientId: idSchema,
  ingredientName: z.string(),
  basisUnit: basisUnitSchema,
  defaultAmount: positiveAmount,
});

export const mealSchema = z.object({
  id: idSchema,
  name: nameSchema,
  notes: z.string().nullable(),
  items: z.array(mealItemSchema),
  nutrition: nutritionSchema.describe('Computed from current ingredient definitions at default amounts'),
});

export const mealInputSchema = z.object({
  name: nameSchema,
  notes: notesSchema.default(null),
  items: z
    .array(
      z.object({
        id: idSchema.optional().describe('Present to keep an existing item, absent to create one'),
        ingredientId: idSchema,
        defaultAmount: positiveAmount,
      }),
    )
    .min(1, 'a meal must have at least one item'),
});

export const mealListSchema = z.array(mealSchema);

/* ---------------------------------------------------------------------- diary */

export const diaryEntryTypeSchema = z.enum(['meal', 'ingredient']);

export const diaryEntryItemSchema = z.object({
  id: idSchema,
  position: positionSchema,
  ingredientId: idSchema.nullable().describe('Provenance only — null once the ingredient is deleted'),
  ingredientName: z.string(),
  basisAmount: positiveAmount,
  basisUnit: basisUnitSchema,
  basis: nutritionSchema.describe('Frozen copy of the ingredient at save time'),
  amount: positiveAmount,
  nutrition: nutritionSchema.describe('scale(basis, amount), derived on read'),
});

export const diaryEntrySchema = z.object({
  id: idSchema,
  date: dateSchema,
  position: positionSchema,
  type: diaryEntryTypeSchema,
  name: z.string().describe('Meal name for meal entries, ingredient name for ingredient entries'),
  mealId: idSchema.nullable().describe('Provenance only — null once the meal is deleted'),
  items: z.array(diaryEntryItemSchema),
  nutrition: nutritionSchema,
});

export const diaryDaySchema = z.object({
  date: dateSchema,
  entries: z.array(diaryEntrySchema),
  totals: nutritionSchema,
});

export const diaryQuerySchema = z.object({ date: dateSchema });

export const createMealEntrySchema = z.object({
  date: dateSchema,
  type: z.literal('meal'),
  mealId: idSchema,
  items: z
    .array(z.object({ mealItemId: idSchema, amount: positiveAmount }))
    .optional()
    .default([])
    .describe('Amount overrides; omitted meal items fall back to their default amount'),
});

export const createIngredientEntrySchema = z.object({
  date: dateSchema,
  type: z.literal('ingredient'),
  ingredientId: idSchema,
  amount: positiveAmount,
});

export const createDiaryEntrySchema = z.discriminatedUnion('type', [
  createMealEntrySchema,
  createIngredientEntrySchema,
]);

export const updateDiaryEntrySchema = z
  .object({
    date: dateSchema.optional(),
    position: positionSchema.optional(),
    items: z
      .array(z.object({ id: idSchema, amount: positiveAmount }))
      .optional()
      .describe('Items are addressed by their own id; they cannot be added or removed'),
  })
  .refine(
    (value) => value.date !== undefined || value.position !== undefined || value.items !== undefined,
    { message: 'provide at least one of date, position or items' },
  );

/* --------------------------------------------------------------------- weight */

export const weightEntrySchema = z.object({
  id: idSchema,
  date: dateSchema,
  weightKg: z.number().finite().min(20).max(400),
  notes: z.string().nullable(),
});

export const weightInputSchema = z.object({
  date: dateSchema,
  weightKg: z.number().finite().min(20, 'weight must be at least 20kg').max(400, 'weight must be at most 400kg'),
  notes: notesSchema.default(null),
});

export const weightQuerySchema = z
  .object({
    from: dateSchema.optional(),
    to: dateSchema.optional(),
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    message: 'from must not be after to',
  });

export const weightListSchema = z.array(weightEntrySchema);

/* ------------------------------------------------------------------- settings */

export const settingsSchema = z.object({
  goalWeightKg: z.number().finite().positive().nullable(),
  preferredUnit: preferredUnitSchema,
});

export const settingsInputSchema = z.object({
  goalWeightKg: z.number().finite().positive().nullish().transform((value) => value ?? null),
  preferredUnit: preferredUnitSchema.default('kg'),
});

/* --------------------------------------------------------------------- errors */

export const errorSchema = z.object({
  statusCode: z.number().int(),
  error: z.string(),
  message: z.string(),
  details: z.unknown().optional().describe('Structured context for the failure, when there is any'),
});

export const ingredientConflictSchema = errorSchema.extend({
  details: z.object({
    meals: z.array(mealRefSchema).describe('Meals still referencing the ingredient'),
  }),
});

export const idParamSchema = z.object({ id: idSchema });

export const deletedSchema = z.object({ deleted: z.literal(true) });

/* ---------------------------------------------------------------------- types */

export type Ingredient = z.infer<typeof ingredientSchema>;
export type IngredientInput = z.input<typeof ingredientInputSchema>;
export type IngredientDeleteResult = z.infer<typeof ingredientDeleteResultSchema>;
export type MealRef = z.infer<typeof mealRefSchema>;
export type Meal = z.infer<typeof mealSchema>;
export type MealItem = z.infer<typeof mealItemSchema>;
export type MealInput = z.input<typeof mealInputSchema>;
export type DiaryEntry = z.infer<typeof diaryEntrySchema>;
export type DiaryEntryItem = z.infer<typeof diaryEntryItemSchema>;
export type DiaryDay = z.infer<typeof diaryDaySchema>;
export type CreateDiaryEntryInput = z.input<typeof createDiaryEntrySchema>;
export type UpdateDiaryEntryInput = z.input<typeof updateDiaryEntrySchema>;
export type WeightEntry = z.infer<typeof weightEntrySchema>;
export type WeightInput = z.input<typeof weightInputSchema>;
export type Settings = z.infer<typeof settingsSchema>;
export type SettingsInput = z.input<typeof settingsInputSchema>;
