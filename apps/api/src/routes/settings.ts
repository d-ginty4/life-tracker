import { errorSchema, settingsInputSchema, settingsSchema } from '@health-tracker/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { getSettings, updateSettings } from '../services/settings.js';

const tags = ['Settings'];

export const settingsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/settings',
    {
      schema: {
        tags,
        summary: 'Get goal weight and preferred unit',
        description: 'There is no daily calorie goal in v1.',
        response: { 200: settingsSchema },
      },
    },
    async () => getSettings(app.db),
  );

  app.put(
    '/settings',
    {
      schema: {
        tags,
        summary: 'Update goal weight and preferred unit',
        body: settingsInputSchema,
        response: { 200: settingsSchema, 400: errorSchema },
      },
    },
    async (request) => updateSettings(app.db, request.body),
  );
};
