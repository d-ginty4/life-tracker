import {
  errorSchema,
  idParamSchema,
  ingredientConflictSchema,
  ingredientDeleteQuerySchema,
  ingredientDeleteResultSchema,
  ingredientInputSchema,
  ingredientListSchema,
  ingredientSchema,
} from '@health-tracker/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import {
  createIngredient,
  deleteIngredient,
  getIngredient,
  listIngredients,
  updateIngredient,
} from '../services/ingredients.js';

const tags = ['Ingredients'];

export const ingredientRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/ingredients',
    {
      schema: {
        tags,
        summary: 'List all ingredients',
        description: 'Ordered by name, case-insensitive.',
        response: { 200: ingredientListSchema },
      },
    },
    async () => listIngredients(app.db),
  );

  app.post(
    '/ingredients',
    {
      schema: {
        tags,
        summary: 'Create an ingredient',
        description: 'Nutrition values apply to `basisAmount` of `basisUnit` and scale linearly from there.',
        body: ingredientInputSchema,
        response: { 201: ingredientSchema, 400: errorSchema },
      },
    },
    async (request, reply) => reply.code(201).send(createIngredient(app.db, request.body)),
  );

  app.get(
    '/ingredients/:id',
    {
      schema: {
        tags,
        summary: 'Get an ingredient',
        params: idParamSchema,
        response: { 200: ingredientSchema, 404: errorSchema },
      },
    },
    async (request) => getIngredient(app.db, request.params.id),
  );

  app.put(
    '/ingredients/:id',
    {
      schema: {
        tags,
        summary: 'Update an ingredient',
        description:
          'Meals pick up the new values immediately; existing diary entries keep the snapshot they were saved with.',
        params: idParamSchema,
        body: ingredientInputSchema,
        response: { 200: ingredientSchema, 400: errorSchema, 404: errorSchema },
      },
    },
    async (request) => updateIngredient(app.db, request.params.id, request.body),
  );

  app.delete(
    '/ingredients/:id',
    {
      schema: {
        tags,
        summary: 'Delete an ingredient',
        description:
          'Rejected with 409 while any meal still uses the ingredient. `?force=true` strips it from those meals and deletes any meal left with no items. Diary entries are never affected — they keep their snapshots and lose only the `ingredientId` link.',
        params: idParamSchema,
        querystring: ingredientDeleteQuerySchema,
        response: {
          200: ingredientDeleteResultSchema,
          404: errorSchema,
          409: ingredientConflictSchema,
        },
      },
    },
    async (request) => deleteIngredient(app.db, request.params.id, request.query.force),
  );
};
