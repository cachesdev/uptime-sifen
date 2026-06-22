import { db } from './db';
import { serviceStatus } from './db/schema';
import { sql } from 'drizzle-orm';

export type Estado = 'VERDE' | 'AMARILLO' | 'ROJO';
export type Entorno = 'PRODUCCION' | 'TEST';

export interface SifenService {
	nombreServicio: string;
	estado: Estado;
	esLote: 'S' | 'N';
	tiempoPromedio: number;
}

export interface SifenResponse {
	data: SifenService[];
	mensaje: string;
}

const SIFEN_ENDPOINT = 'https://semaforo-sifen.dnit.gov.py/semafororest/estado';

function extractEntorno(serviceName: string): Entorno {
	return serviceName.includes('Test') ? 'TEST' : 'PRODUCCION';
}

export async function fetchSifenStatus(): Promise<SifenResponse | null> {
	try {
		const res = await fetch(SIFEN_ENDPOINT, {
			headers: { Accept: 'application/json' },
			signal: AbortSignal.timeout(15_000)
		});

		if (!res.ok) return null;

		const body: unknown = await res.json();

		if (typeof body !== 'object' || body === null || !Array.isArray((body as SifenResponse).data)) {
			return null;
		}

		return body as SifenResponse;
	} catch {
		return null;
	}
}

export async function ingestSamples(response: SifenResponse): Promise<void> {
	const sampledAt = new Date();

	await db
		.insert(serviceStatus)
		.values(
			response.data.map((s) => ({
				sampledAt,
				servicio: s.nombreServicio,
				entorno: extractEntorno(s.nombreServicio),
				esLote: s.esLote === 'S',
				estado: s.estado,
				tiempoPromedioMs: s.tiempoPromedio
			}))
		)
		.execute();
}

export async function pollAndIngest(): Promise<void> {
	const response = await fetchSifenStatus();
	if (response) {
		await ingestSamples(response);
	}
}

export async function pruneHistory(): Promise<void> {
	await db.execute(sql`DELETE FROM service_status WHERE sampled_at < now() - interval '60 days'`);
}
