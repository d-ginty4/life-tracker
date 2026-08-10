import { eq } from 'drizzle-orm';
import type { Settings } from '@health-tracker/shared';
import type { Db } from '../db/client.js';
import { settings } from '../db/schema.js';

/** Settings are a singleton row; the app has exactly one user. */
const SETTINGS_ID = 1;

const DEFAULTS: Settings = { goalWeightKg: null, preferredUnit: 'kg' };

export function getSettings(db: Db): Settings {
  const row = db.select().from(settings).where(eq(settings.id, SETTINGS_ID)).get();
  if (!row) return { ...DEFAULTS };
  return { goalWeightKg: row.goalWeightKg, preferredUnit: row.preferredUnit };
}

export function updateSettings(db: Db, input: Settings): Settings {
  db.insert(settings)
    .values({ id: SETTINGS_ID, ...input })
    .onConflictDoUpdate({ target: settings.id, set: input })
    .run();
  return { ...input };
}
