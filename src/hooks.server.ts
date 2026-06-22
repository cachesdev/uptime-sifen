import type { Handle } from '@sveltejs/kit';
import cron from 'node-cron';
import { pollAndIngest, pruneHistory } from '$lib/server/sifen';
import { dev } from '$app/env';

function startTasks() {
  if (globalThis.__sifenStarted) return;
  globalThis.__sifenStarted = true;

  void pollAndIngest();
  void pruneHistory();

  cron.schedule('*/1 * * * *', () => void pollAndIngest());
  cron.schedule('0 3 * * *', () => void pruneHistory());

  if (dev) console.log('[sifen] sampling tasks started');
}

export const handle: Handle = async ({ event, resolve }) => {
  startTasks();
  return resolve(event);
};
