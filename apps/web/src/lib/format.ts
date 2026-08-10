import {
  roundNutrition,
  scaleNutrition,
  type BasisUnit,
  type Ingredient,
  type Nutrition,
  type NutritionBasis,
  type PreferredUnit,
} from '@health-tracker/shared';

const KG_PER_LB = 0.45359237;

export function ingredientBasis(ingredient: Ingredient): NutritionBasis {
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

export function previewScale(source: NutritionBasis, amount: number): Nutrition {
  if (!Number.isFinite(amount) || amount <= 0) {
    return { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  }
  return scaleNutrition(source, amount);
}

export function formatCalories(n: Nutrition): string {
  return `${roundNutrition(n).calories}`;
}

export function formatMacro(value: number): string {
  return roundNutrition({
    calories: 0,
    protein: value,
    carbs: 0,
    fat: 0,
    fiber: 0,
  }).protein.toFixed(1);
}

export function formatNutritionLine(n: Nutrition): string {
  const r = roundNutrition(n);
  return `${r.calories} kcal · P ${r.protein.toFixed(1)} · C ${r.carbs.toFixed(1)} · F ${r.fat.toFixed(1)} · Fi ${r.fiber.toFixed(1)}`;
}

export function unitLabel(unit: BasisUnit): string {
  return unit === 'unit' ? 'unit' : unit;
}

export function formatAmount(amount: number, unit: BasisUnit): string {
  const pretty = Number.isInteger(amount) ? String(amount) : amount.toFixed(1).replace(/\.0$/, '');
  return unit === 'unit' ? `${pretty}` : `${pretty}${unit}`;
}

export function kgToDisplay(kg: number, preferred: PreferredUnit): number {
  return preferred === 'lb' ? kg / KG_PER_LB : kg;
}

export function displayToKg(value: number, preferred: PreferredUnit): number {
  return preferred === 'lb' ? value * KG_PER_LB : value;
}

export function formatWeight(kg: number, preferred: PreferredUnit): string {
  const value = kgToDisplay(kg, preferred);
  return `${value.toFixed(1)} ${preferred}`;
}

export function weightUnitLabel(preferred: PreferredUnit): string {
  return preferred;
}
