import { NUTRIENT_KEYS, type Nutrition, type NutritionBasis } from './types.js';

/**
 * Arithmetic on IEEE doubles leaves artefacts like 4.7250000000000005. Values are kept at
 * full precision, so the only thing trimmed here is noise far below a measurable quantity.
 */
const SIGNIFICANT_DECIMALS = 10;

function denoise(value: number): number {
  return Number(value.toFixed(SIGNIFICANT_DECIMALS));
}

export function emptyNutrition(): Nutrition {
  return { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
}

/** Throws on basisAmount <= 0 or amount < 0. */
export function scaleNutrition(source: NutritionBasis, amount: number): Nutrition {
  if (!Number.isFinite(source.basisAmount) || source.basisAmount <= 0) {
    throw new RangeError(`basisAmount must be > 0, received ${source.basisAmount}`);
  }
  if (!Number.isFinite(amount) || amount < 0) {
    throw new RangeError(`amount must be >= 0, received ${amount}`);
  }

  const factor = amount / source.basisAmount;
  const scaled = emptyNutrition();
  for (const key of NUTRIENT_KEYS) {
    scaled[key] = denoise(source.basis[key] * factor);
  }
  return scaled;
}

export function sumNutrition(parts: Nutrition[]): Nutrition {
  const total = emptyNutrition();
  for (const part of parts) {
    for (const key of NUTRIENT_KEYS) {
      total[key] += part[key];
    }
  }
  for (const key of NUTRIENT_KEYS) {
    total[key] = denoise(total[key]);
  }
  return total;
}

/** Display only — never applied before storage. */
export function roundNutrition(n: Nutrition): Nutrition {
  return {
    calories: Math.round(n.calories),
    protein: denoise(Number(n.protein.toFixed(1))),
    carbs: denoise(Number(n.carbs.toFixed(1))),
    fat: denoise(Number(n.fat.toFixed(1))),
    fiber: denoise(Number(n.fiber.toFixed(1))),
  };
}
