import { db } from './db';
import { serviceStatus } from './db/schema';
import { sql } from 'drizzle-orm';

export type Estado = 'VERDE' | 'AMARILLO' | 'ROJO';
export type Entorno = 'PRODUCCION' | 'TEST';

export interface ServicioSifen {
	nombreServicio: string;
	estado: Estado;
	esLote: 'S' | 'N';
	tiempoPromedio: number;
}

export interface RespuestaSifen {
	data: ServicioSifen[];
	mensaje: string;
}

const ENDPOINT_SIFEN = 'https://semaforo-sifen.dnit.gov.py/semafororest/estado';

function derivarEntorno(nombreServicio: string): Entorno {
	return nombreServicio.includes('Test') ? 'TEST' : 'PRODUCCION';
}

export async function sondearSifen(): Promise<RespuestaSifen | null> {
	try {
		const res = await fetch(ENDPOINT_SIFEN, {
			headers: { Accept: 'application/json' },
			signal: AbortSignal.timeout(15_000)
		});

		if (!res.ok) return null;

		const body: unknown = await res.json();

		if (
			typeof body !== 'object' ||
			body === null ||
			!Array.isArray((body as RespuestaSifen).data)
		) {
			return null;
		}

		return body as RespuestaSifen;
	} catch {
		return null;
	}
}

export async function ingestar(respuesta: RespuestaSifen): Promise<void> {
	const sampledAt = new Date();

	await db
		.insert(serviceStatus)
		.values(
			respuesta.data.map((s) => ({
				sampledAt,
				servicio: s.nombreServicio,
				entorno: derivarEntorno(s.nombreServicio),
				esLote: s.esLote === 'S',
				estado: s.estado,
				tiempoPromedioMs: s.tiempoPromedio
			}))
		)
		.execute();
}

export async function sondearEIngestar(): Promise<void> {
	const respuesta = await sondearSifen();
	if (respuesta) {
		await ingestar(respuesta);
	}
}

export async function podarHistorial(): Promise<void> {
	await db.execute(sql`DELETE FROM service_status WHERE sampled_at < now() - interval '60 days'`);
}
