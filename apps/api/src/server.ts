import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { createDatabase, runMigrations } from './db/client.js';

const config = loadConfig();
const { db, close } = createDatabase(config.databaseUrl);
runMigrations(db, config.migrationsFolder);

const app = await buildApp({
  db,
  logger: { level: config.logLevel },
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void app.close().then(() => {
      close();
      process.exit(0);
    });
  });
}

try {
  await app.listen({ host: config.host, port: config.port });
  app.log.info(`API docs on http://${config.host}:${config.port}/docs`);
} catch (error) {
  app.log.error(error);
  close();
  process.exit(1);
}
