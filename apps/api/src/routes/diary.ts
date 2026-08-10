import {
  createDiaryEntrySchema,
  deletedSchema,
  diaryDaySchema,
  diaryEntrySchema,
  diaryQuerySchema,
  errorSchema,
  idParamSchema,
  updateDiaryEntrySchema,
} from '@health-tracker/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { createEntry, deleteEntry, getDay, updateEntry } from '../services/diary.js';

const tags = ['Diary'];

export const diaryRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/diary',
    {
      schema: {
        tags,
        summary: 'Get a day of entries with totals',
        description:
          'Entries are ordered by `position`. Totals are summed from unrounded values, so they can differ from the sum of the rounded rows shown in a UI.',
        querystring: diaryQuerySchema,
        response: { 200: diaryDaySchema, 400: errorSchema },
      },
    },
    async (request) => getDay(app.db, request.query.date),
  );

  app.post(
    '/diary/entries',
    {
      schema: {
        tags,
        summary: 'Log a meal or a single ingredient',
        description:
          'A meal entry expands into one item per meal ingredient, with amounts taken from the meal defaults unless overridden by `mealItemId`. The ingredient snapshot is frozen onto every item here and never refreshed afterwards.',
        body: createDiaryEntrySchema,
        response: { 201: diaryEntrySchema, 400: errorSchema, 404: errorSchema },
      },
    },
    async (request, reply) => reply.code(201).send(createEntry(app.db, request.body)),
  );

  app.put(
    '/diary/entries/:id',
    {
      schema: {
        tags,
        summary: 'Update amounts, date or position',
        description:
          'Items are addressed by their own `id` and rescale from their stored snapshot — the meal or ingredient they came from is never re-read. Items cannot be added or removed; delete the entry and re-log instead.',
        params: idParamSchema,
        body: updateDiaryEntrySchema,
        response: { 200: diaryEntrySchema, 400: errorSchema, 404: errorSchema },
      },
    },
    async (request) => updateEntry(app.db, request.params.id, request.body),
  );

  app.delete(
    '/diary/entries/:id',
    {
      schema: {
        tags,
        summary: 'Delete an entry and its items',
        params: idParamSchema,
        response: { 200: deletedSchema, 404: errorSchema },
      },
    },
    async (request) => {
      deleteEntry(app.db, request.params.id);
      return { deleted: true as const };
    },
  );
};
