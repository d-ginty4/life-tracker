export type BasisUnit = 'g' | 'ml' | 'unit';

export const BASIS_UNITS: readonly BasisUnit[] = ['g', 'ml', 'unit'];

export type Nutrition = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
};

export const NUTRIENT_KEYS = ['calories', 'protein', 'carbs', 'fat', 'fiber'] as const;

/** The frozen part of an ingredient that a diary item copies at save time. */
export type NutritionBasis = {
  basisAmount: number;
  basisUnit: BasisUnit;
  basis: Nutrition;
};

export type DiaryEntryType = 'meal' | 'ingredient';

export type PreferredUnit = 'kg' | 'lb';
