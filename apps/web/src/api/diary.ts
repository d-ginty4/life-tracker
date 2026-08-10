import type {
  CreateDiaryEntryInput,
  DiaryDay,
  DiaryEntry,
  UpdateDiaryEntryInput,
} from '@health-tracker/shared';
import { apiRequest } from './client';

export function getDiaryDay(date: string): Promise<DiaryDay> {
  return apiRequest(`/diary?date=${encodeURIComponent(date)}`);
}

export function createDiaryEntry(input: CreateDiaryEntryInput): Promise<DiaryEntry> {
  return apiRequest('/diary/entries', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateDiaryEntry(id: string, input: UpdateDiaryEntryInput): Promise<DiaryEntry> {
  return apiRequest(`/diary/entries/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export function deleteDiaryEntry(id: string): Promise<{ deleted: true }> {
  return apiRequest(`/diary/entries/${id}`, { method: 'DELETE' });
}
