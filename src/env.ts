import { defineEnvVars } from '@sveltejs/kit/hooks';
import { building } from '$app/env';
import * as v from 'valibot';

export const variables = defineEnvVars({
  DATABASE_URL: {
    description: 'The database connection string.',
    static: false,
    schema: v.pipe(
      v.optional(v.string()),
      v.check((value) => building || value !== undefined, 'Value is missing')
    )
  }
});
