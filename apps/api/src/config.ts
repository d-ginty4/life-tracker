import { fileURLToPath } from 'node:url';
import path from 'node:path';

function apiRoot(): string {
  if (process.env.LAMBDA_TASK_ROOT) {
    return process.env.LAMBDA_TASK_ROOT;
  }
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
}

export type AppConfig = {
  host: string;
  port: number;
  databaseUrl: string;
  logLevel: string;
  migrationsFolder: string;
};

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) throw new Error(`${name} must be a number, received "${raw}"`);
  return parsed;
}

export function loadConfig(): AppConfig {
  return {
    host: process.env.HOST ?? '127.0.0.1',
    port: envNumber('PORT', 3000),
    databaseUrl: process.env.DATABASE_URL ?? path.join(apiRoot(), 'data', 'health-tracker.sqlite'),
    logLevel: process.env.LOG_LEVEL ?? 'info',
    migrationsFolder: path.join(apiRoot(), 'drizzle'),
  };
}

export const MIGRATIONS_FOLDER = path.join(apiRoot(), 'drizzle');
