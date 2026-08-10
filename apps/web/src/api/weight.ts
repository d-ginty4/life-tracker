import type { WeightEntry, WeightInput } from '@health-tracker/shared';
import { apiRequest } from './client';

export function listWeight(from?: string, to?: string): Promise<WeightEntry[]> {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const query = params.toString();
  return apiRequest(`/weight${query ? `?${query}` : ''}`);
}

export function upsertWeight(input: WeightInput): Promise<WeightEntry> {
  return apiRequest('/weight', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function deleteWeight(id: string): Promise<{ deleted: true }> {
  return apiRequest(`/weight/${id}`, { method: 'DELETE' });
}
