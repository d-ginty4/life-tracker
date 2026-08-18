import awsLambdaFastify from '@fastify/aws-lambda';
import type { APIGatewayProxyEventV2, Context } from 'aws-lambda';
import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { createDatabase, runMigrations } from './db/client.js';

type LambdaProxy = (event: APIGatewayProxyEventV2, context: Context) => Promise<unknown>;

let proxy: LambdaProxy | undefined;

async function setup(): Promise<LambdaProxy> {
  const config = loadConfig();
  const { db } = createDatabase(config.databaseUrl);
  runMigrations(db, config.migrationsFolder);
  const app = await buildApp({
    db,
    logger: { level: config.logLevel },
  });
  const proxy = awsLambdaFastify(app) as LambdaProxy;
  await app.ready();
  return proxy;
}

export async function handler(event: APIGatewayProxyEventV2, context: Context) {
  proxy ??= await setup();
  return proxy(event, context);
}
