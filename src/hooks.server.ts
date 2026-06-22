import type { Handle } from '@sveltejs/kit';
import cron from 'node-cron';
import { sondearEIngestar, podarHistorial } from '$lib/server/sifen';
import { dev } from '$app/env';

let iniciado = false;

function iniciarTareas() {
	if (iniciado) return;
	iniciado = true;

	void sondearEIngestar();
	void podarHistorial();

	cron.schedule('*/1 * * * *', () => void sondearEIngestar());
	cron.schedule('0 3 * * *', () => void podarHistorial());

	if (dev) console.log('[sifen] tareas de muestreo iniciadas');
}

export const handle: Handle = async ({ event, resolve }) => {
	iniciarTareas();
	return resolve(event);
};
