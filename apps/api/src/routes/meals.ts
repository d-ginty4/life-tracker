import {
  deletedSchema,
  errorSchema,
  idParamSchema,
  mealInputSchema,
  mealListSchema,
  mealSchema,
} from '@health-tracker/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { createMeal, deleteMeal, getMeal, listMeals, updateMeal } from '../services/meals.js';

const tags = ['Meals'];

export const mealRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/meals',
    {
      schema: {
        tags,
        summary: 'List all meals',
        description: 'Each meal includes its items and the nutrition of those items at their default amounts.',
        response: { 200: mealListSchema },
      },
    },
    async () => listMeals(app.db),
  );

  app.post(
    '/meals',
    {
      schema: {
        tags,
        summary: 'Create a meal',
        description: 'Item order in the request defines `position`. A meal needs at least one item.',
        body: mealInputSchema,
        response: { 201: mealSchema, 400: errorSchema },
      },
    },
    async (request, reply) => reply.code(201).send(createMeal(app.db, request.body)),
  );

  app.get(
    '/meals/:id',
    {
      schema: {
        tags,
        summary: 'Get a meal',
        params: idParamSchema,
        response: { 200: mealSchema, 404: errorSchema },
      },
    },
    async (request) => getMeal(app.db, request.params.id),
  );

  app.put(
    '/meals/:id',
    {
      schema: {
        tags,
        summary: 'Update a meal',
        description:
          'Items are reconciled by `id`: those with an `id` are updated, those without are created, and any existing item missing from the list is deleted.',
        params: idParamSchema,
        body: mealInputSchema,
        response: { 200: mealSchema, 400: errorSchema, 404: errorSchema },
      },
    },
    async (request) => updateMeal(app.db, request.params.id, request.body),
  );

  app.delete(
    '/meals/:id',
    {
      schema: {
        tags,
        summary: 'Delete a meal',
        description: 'Diary entries logged from this meal keep their name and snapshots; only `mealId` becomes null.',
        params: idParamSchema,
        response: { 200: deletedSchema, 404: errorSchema },
      },
    },
    async (request) => {
      deleteMeal(app.db, request.params.id);
      return { deleted: true as const };
    },
  );
};
