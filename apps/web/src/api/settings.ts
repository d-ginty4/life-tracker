import type { Settings, SettingsInput } from '@health-tracker/shared';
import { apiRequest } from './client';

export function getSettings(): Promise<Settings> {
  return apiRequest('/settings');
}

export function updateSettings(input: SettingsInput): Promise<Settings> {
  return apiRequest('/settings', {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}
