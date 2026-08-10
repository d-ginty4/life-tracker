import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify, { type FastifyError, type FastifyInstance, type FastifyServerOptions } from 'fastify';
import {
  hasZodFastifySchemaValidationErrors,
  isResponseSerializationError,
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod';
import type { AppDatabase } from './db/client.js';
import { HttpError } from './errors.js';
import { diaryRoutes } from './routes/diary.js';
import { ingredientRoutes } from './routes/ingredients.js';
import { mealRoutes } from './routes/meals.js';
import { settingsRoutes } from './routes/settings.js';
import { weightRoutes } from './routes/weight.js';

declare module 'fastify' {
  interface FastifyInstance {
    db: AppDatabase;
  }
}

export type BuildAppOptions = {
  db: AppDatabase;
  logger?: FastifyServerOptions['logger'];
};

const API_DESCRIPTION = `Personal health tracker: an ingredient library, meals composed from it, a daily food diary and a weight log.

**Nutrition is never stored as a total.** Ingredients define calories and macros for a basis amount; everything else scales linearly from there. Diary items freeze a copy of the ingredient at save time, so editing or deleting an ingredient can never rewrite history.

**Dates** are local calendar days in \`YYYY-MM-DD\` form, stored verbatim with no timezone conversion.

**Rounding** is a rendering concern — the API returns full precision, and day totals are summed from unrounded values.`;

export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: options.logger ?? false });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorate('db', options.db);

  await app.register(cors, { origin: true });

  await app.register(swagger, {
    openapi: {
      // 3.0.x, because the Zod-to-JSON-Schema transform emits `nullable: true` rather than
      // the union types 3.1 expects.
      openapi: '3.0.3',
      info: {
        title: 'Health Tracker API',
        description: API_DESCRIPTION,
        version: '1.0.0',
      },
      servers: [{ url: '/', description: 'This server' }],
      tags: [
        { name: 'Ingredients', description: 'Manually entered food items with nutrition per basis amount' },
        { name: 'Meals', description: 'Reusable ingredient collections with default amounts' },
        { name: 'Diary', description: 'Daily food log built from meals and single ingredients' },
        { name: 'Weight', description: 'Body weight readings, one per day' },
        { name: 'Settings', description: 'Goal weight and display unit' },
      ],
    },
    transform: jsonSchemaTransform,
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: { docExpansion: 'list', deepLinking: true },
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof HttpError) {
      return reply.status(error.statusCode).send(error.toPayload());
    }

    if (hasZodFastifySchemaValidationErrors(error)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: `Request does not match the schema: ${error.validation
          .map((issue) => `${issue.instancePath || '/'} ${issue.message}`)
          .join('; ')}`,
        details: error.validation,
      });
    }

    if (isResponseSerializationError(error)) {
      request.log.error({ err: error }, 'response did not match its schema');
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'The server produced a response that did not match its schema',
      });
    }

    const failure = error as FastifyError;
    const statusCode = failure.statusCode ?? 500;
    if (statusCode >= 500) {
      request.log.error({ err: failure }, 'request failed');
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Something went wrong',
      });
    }

    return reply.status(statusCode).send({
      statusCode,
      error: failure.name || 'Error',
      message: failure.message,
    });
  });

  app.setNotFoundHandler((request, reply) =>
    reply.status(404).send({
      statusCode: 404,
      error: 'Not Found',
      message: `Route ${request.method} ${request.url} does not exist`,
    }),
  );

  app.get('/health', { schema: { hide: true } }, async () => ({ status: 'ok' }));

  await app.register(
    async (api) => {
      await api.register(ingredientRoutes);
      await api.register(mealRoutes);
      await api.register(diaryRoutes);
      await api.register(weightRoutes);
      await api.register(settingsRoutes);
    },
    { prefix: '/api' },
  );

  return app;
}
