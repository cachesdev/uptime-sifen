import type { Handle } from '@sveltejs/kit';
import cron from 'node-cron';
import { pollAndIngest, pruneHistory } from '$lib/server/sifen';
import { dev } from '$app/env';

let started = false;

function startTasks() {
  if (started) return;
  started = true;

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
