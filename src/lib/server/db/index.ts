import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';
import { DATABASE_URL } from '$app/env/private';
import { building } from '$app/env';

const config = { schema, relations: {} };

function createDb(databaseUrl: string) {
  return drizzle(databaseUrl, config);
}

export let db: ReturnType<typeof createDb>;

if (!building) {
  if (!DATABASE_URL) throw new Error('DATABASE_URL is not set');
  db = createDb(DATABASE_URL);
}
