import type { Meal, MealInput } from '@health-tracker/shared';
import { apiRequest } from './client';

export function listMeals(): Promise<Meal[]> {
  return apiRequest('/meals');
}

export function getMeal(id: string): Promise<Meal> {
  return apiRequest(`/meals/${id}`);
}

export function createMeal(input: MealInput): Promise<Meal> {
  return apiRequest('/meals', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateMeal(id: string, input: MealInput): Promise<Meal> {
  return apiRequest(`/meals/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export function deleteMeal(id: string): Promise<{ deleted: true }> {
  return apiRequest(`/meals/${id}`, { method: 'DELETE' });
}
