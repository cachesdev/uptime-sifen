import { query, command, requested } from '$app/server';
import * as v from 'valibot';
import { db } from '$lib/server/db';
import { sql } from 'drizzle-orm';
import { sondearEIngestar } from '$lib/server/sifen';
import type {
	DataPoint,
	HealthChartStatus,
	HealthChartRange
} from '$lib/components/ui/health-chart';

const RangoSchema = v.picklist(['60m', '24h', '30d', '60d']);

const VENTANA: Record<HealthChartRange, string> = {
	'60m': '60 minutes',
	'24h': '24 hours',
	'30d': '30 days',
	'60d': '60 days'
};

const DOWNSAMPLE: Record<HealthChartRange, string | null> = {
	'60m': null,
	'24h': null,
	'30d': '1 hour',
	'60d': '1 hour'
};

function estadoASalud(estado: string): HealthChartStatus {
	switch (estado) {
		case 'VERDE':
			return 'green';
		case 'AMARILLO':
			return 'orange';
		case 'ROJO':
			return 'red';
		default:
			return 'gray';
	}
}

function descripcionPunto(estado: string, tiempoMs: number): string {
	const etiqueta = estado.charAt(0) + estado.slice(1).toLowerCase();
	return `${etiqueta}, ${tiempoMs} ms`;
}

export const datosDashboard = query(RangoSchema, async (range) => {
	const ventana = VENTANA[range];
	const bucket = DOWNSAMPLE[range];

	const filasKpi = await db.execute(sql`
		SELECT
			servicio,
			entorno,
			es_lote,
			COUNT(*) FILTER (WHERE estado = 'VERDE')::float / NULLIF(COUNT(*), 0) AS disponibilidad,
			(array_agg(estado ORDER BY sampled_at DESC))[1] AS ultimo_estado,
			(array_agg(tiempo_promedio_ms ORDER BY sampled_at DESC))[1] AS ultimo_tiempo_ms,
			MAX(sampled_at) AS ultima_muestra
		FROM service_status
		WHERE sampled_at >= now() - interval ${sql.raw(`'${ventana}'`)}
		GROUP BY servicio, entorno, es_lote
		ORDER BY servicio
	`);

	type FilaKpi = {
		servicio: string;
		entorno: string;
		es_lote: boolean;
		disponibilidad: number | null;
		ultimo_estado: string | null;
		ultimo_tiempo_ms: number | null;
		ultima_muestra: Date | null;
	};

	const kpis = filasKpi as unknown as FilaKpi[];

	let filasPuntos: Array<{
		servicio: string;
		estado: string;
		tiempo_promedio_ms: number;
		sampled_at: Date;
	}>;

	if (bucket) {
		const resultado = await db.execute(sql`
			SELECT DISTINCT ON (servicio, date_trunc(${bucket}, sampled_at))
				servicio, estado, tiempo_promedio_ms, sampled_at
			FROM service_status
			WHERE sampled_at >= now() - interval ${sql.raw(`'${ventana}'`)}
			ORDER BY servicio, date_trunc(${bucket}, sampled_at), sampled_at DESC
		`);
		filasPuntos = resultado as unknown as typeof filasPuntos;
	} else {
		const resultado = await db.execute(sql`
			SELECT servicio, estado, tiempo_promedio_ms, sampled_at
			FROM service_status
			WHERE sampled_at >= now() - interval ${sql.raw(`'${ventana}'`)}
			ORDER BY servicio, sampled_at
		`);
		filasPuntos = resultado as unknown as typeof filasPuntos;
	}

	const puntosPorServicio = new Map<string, DataPoint[]>();
	for (const fila of filasPuntos) {
		const existentes = puntosPorServicio.get(fila.servicio) ?? [];
		existentes.push({
			status: estadoASalud(fila.estado),
			description: descripcionPunto(fila.estado, fila.tiempo_promedio_ms),
			timestamp: fila.sampled_at
		});
		puntosPorServicio.set(fila.servicio, existentes);
	}

	let ultimaMuestra: Date | null = null;

	const servicios = kpis.map((kpi) => {
		if (kpi.ultima_muestra && (!ultimaMuestra || kpi.ultima_muestra > ultimaMuestra)) {
			ultimaMuestra = kpi.ultima_muestra;
		}
		return {
			nombre: kpi.servicio,
			entorno: kpi.entorno as 'PRODUCCION' | 'TEST',
			esLote: kpi.es_lote,
			puntos: puntosPorServicio.get(kpi.servicio) ?? [],
			disponibilidad: kpi.disponibilidad ?? 0,
			ultimoEstado: kpi.ultimo_estado as 'VERDE' | 'AMARILLO' | 'ROJO' | null,
			ultimoTiempoMs: kpi.ultimo_tiempo_ms
		};
	});

	return { servicios, ultimaMuestra };
});

export const refrescarAhora = command(async () => {
	await sondearEIngestar();
	await requested(datosDashboard, 4).refreshAll();
});
