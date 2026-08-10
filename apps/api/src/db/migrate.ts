import { loadConfig } from '../config.js';
import { createDatabase, runMigrations } from './client.js';

const config = loadConfig();
const handle = createDatabase(config.databaseUrl);

try {
  runMigrations(handle.db, config.migrationsFolder);
  console.log(`Migrations applied to ${config.databaseUrl}`);
} finally {
  handle.close();
}
