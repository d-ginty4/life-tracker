import fs from 'node:fs/promises';
import path from 'node:path';
import { buildApp } from './app.js';
import { createDatabase, runMigrations } from './db/client.js';

/** Writes the generated OpenAPI document to disk for client generation or review. */
const { db, close } = createDatabase(':memory:');
runMigrations(db);

const app = await buildApp({ db });
await app.ready();

const target = process.argv[2] ?? path.join(process.cwd(), 'openapi.json');
await fs.writeFile(target, `${JSON.stringify(app.swagger(), null, 2)}\n`);
console.log(`OpenAPI document written to ${target}`);

await app.close();
close();
