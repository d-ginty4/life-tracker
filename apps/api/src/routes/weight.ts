import {
  deletedSchema,
  errorSchema,
  idParamSchema,
  weightEntrySchema,
  weightInputSchema,
  weightListSchema,
  weightQuerySchema,
} from '@health-tracker/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { deleteWeightEntry, listWeightEntries, upsertWeightEntry } from '../services/weight.js';

const tags = ['Weight'];

export const weightRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/weight',
    {
      schema: {
        tags,
        summary: 'List weigh-ins in a date range',
        description: 'Both bounds are inclusive and optional. Entries are ordered by date ascending.',
        querystring: weightQuerySchema,
        response: { 200: weightListSchema, 400: errorSchema },
      },
    },
    async (request) => listWeightEntries(app.db, request.query),
  );

  app.post(
    '/weight',
    {
      schema: {
        tags,
        summary: 'Record a weigh-in',
        description: 'Upserts by date — posting a date that already has an entry overwrites it and returns 200.',
        body: weightInputSchema,
        response: { 200: weightEntrySchema, 201: weightEntrySchema, 400: errorSchema },
      },
    },
    async (request, reply) => {
      const { entry, created } = upsertWeightEntry(app.db, request.body);
      return reply.code(created ? 201 : 200).send(entry);
    },
  );

  app.delete(
    '/weight/:id',
    {
      schema: {
        tags,
        summary: 'Delete a weigh-in',
        params: idParamSchema,
        response: { 200: deletedSchema, 404: errorSchema },
      },
    },
    async (request) => {
      deleteWeightEntry(app.db, request.params.id);
      return { deleted: true as const };
    },
  );
};
