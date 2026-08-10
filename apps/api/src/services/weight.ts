import { randomUUID } from 'node:crypto';
import { and, eq, gte, lte, type SQL } from 'drizzle-orm';
import type { WeightEntry } from '@health-tracker/shared';
import type { Db } from '../db/client.js';
import { weightEntries, type WeightEntryRow } from '../db/schema.js';
import { notFound } from '../errors.js';

export type WeightInput = { date: string; weightKg: number; notes: string | null };

export type WeightUpsertResult = { entry: WeightEntry; created: boolean };

function toWeightEntry(row: WeightEntryRow): WeightEntry {
  return { id: row.id, date: row.date, weightKg: row.weightKg, notes: row.notes };
}

export function listWeightEntries(db: Db, range: { from?: string; to?: string } = {}): WeightEntry[] {
  const filters: SQL[] = [];
  if (range.from) filters.push(gte(weightEntries.date, range.from));
  if (range.to) filters.push(lte(weightEntries.date, range.to));

  const query = db.select().from(weightEntries);
  const filtered = filters.length > 0 ? query.where(and(...filters)) : query;

  return filtered.orderBy(weightEntries.date).all().map(toWeightEntry);
}

/** One entry per date: re-posting the same date overwrites it rather than adding a second row. */
export function upsertWeightEntry(db: Db, input: WeightInput): WeightUpsertResult {
  const existing = db.select().from(weightEntries).where(eq(weightEntries.date, input.date)).get();

  if (existing) {
    db.update(weightEntries)
      .set({ weightKg: input.weightKg, notes: input.notes })
      .where(eq(weightEntries.id, existing.id))
      .run();
    return { entry: toWeightEntry({ ...existing, ...input }), created: false };
  }

  const row: WeightEntryRow = { id: randomUUID(), ...input };
  db.insert(weightEntries).values(row).run();
  return { entry: toWeightEntry(row), created: true };
}

export function deleteWeightEntry(db: Db, id: string): void {
  const existing = db.select().from(weightEntries).where(eq(weightEntries.id, id)).get();
  if (!existing) throw notFound('Weight entry', id);
  db.delete(weightEntries).where(eq(weightEntries.id, id)).run();
}
