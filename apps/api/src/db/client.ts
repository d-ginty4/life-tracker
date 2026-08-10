import fs from 'node:fs';
import path from 'node:path';
import BetterSqlite3 from 'better-sqlite3';
import type { ExtractTablesWithRelations } from 'drizzle-orm';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { SQLiteTransaction } from 'drizzle-orm/sqlite-core';
import { MIGRATIONS_FOLDER } from '../config.js';
import * as schema from './schema.js';

export type AppDatabase = BetterSQLite3Database<typeof schema>;

export type AppTransaction = SQLiteTransaction<
  'sync',
  BetterSqlite3.RunResult,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

/** Anything a service can run queries against, inside a transaction or not. */
export type Db = AppDatabase | AppTransaction;

export type DatabaseHandle = {
  db: AppDatabase;
  sqlite: BetterSqlite3.Database;
  close: () => void;
};

export function createDatabase(databaseUrl: string): DatabaseHandle {
  if (databaseUrl !== ':memory:') {
    fs.mkdirSync(path.dirname(path.resolve(databaseUrl)), { recursive: true });
  }

  const sqlite = new BetterSqlite3(databaseUrl);
  if (databaseUrl !== ':memory:') {
    sqlite.pragma('journal_mode = WAL');
  }
  // Without this SQLite ignores the RESTRICT / SET NULL / CASCADE rules the design relies on.
  sqlite.pragma('foreign_keys = ON');

  const db = drizzle(sqlite, { schema });
  return { db, sqlite, close: () => sqlite.close() };
}

export function runMigrations(db: AppDatabase, migrationsFolder: string = MIGRATIONS_FOLDER): void {
  migrate(db, { migrationsFolder });
}
