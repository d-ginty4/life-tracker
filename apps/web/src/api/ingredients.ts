import type {
  Ingredient,
  IngredientDeleteResult,
  IngredientInput,
} from '@health-tracker/shared';
import { apiRequest } from './client';

export function listIngredients(): Promise<Ingredient[]> {
  return apiRequest('/ingredients');
}

export function createIngredient(input: IngredientInput): Promise<Ingredient> {
  return apiRequest('/ingredients', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateIngredient(id: string, input: IngredientInput): Promise<Ingredient> {
  return apiRequest(`/ingredients/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export function deleteIngredient(id: string, force = false): Promise<IngredientDeleteResult> {
  const query = force ? '?force=true' : '';
  return apiRequest(`/ingredients/${id}${query}`, { method: 'DELETE' });
}
