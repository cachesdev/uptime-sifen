import { query, command } from '$app/server';
import * as v from 'valibot';
import { db } from '$lib/server/db';
import { sql } from 'drizzle-orm';
import { pollAndIngest } from '$lib/server/sifen';
import type {
	DataPoint,
	HealthChartStatus,
	HealthChartRange
} from '$lib/components/ui/health-chart';

const rangeSchema = v.picklist(['60m', '24h', '30d', '60d']);

const WINDOW: Record<HealthChartRange, string> = {
	'60m': '60 minutes',
	'24h': '24 hours',
	'30d': '30 days',
	'60d': '60 days'
};

const DOWNSAMPLE: Record<HealthChartRange, string | null> = {
	'60m': null,
	'24h': null,
	'30d': 'hour',
	'60d': 'hour'
};

function toHealthStatus(estado: string): HealthChartStatus {
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

function pointDescription(estado: string, responseMs: number): string {
	const label = estado.charAt(0) + estado.slice(1).toLowerCase();
	return `${label}, ${responseMs} ms`;
}

export const dashboardData = query(rangeSchema, async (range) => {
	const window = WINDOW[range];
	const bucket = DOWNSAMPLE[range];

	const kpiResult = await db.execute(sql`
		SELECT
			servicio,
			entorno,
			es_lote,
			COUNT(*) FILTER (WHERE estado = 'VERDE')::float / NULLIF(COUNT(*), 0) AS availability,
			(array_agg(estado ORDER BY sampled_at DESC))[1] AS last_estado,
			(array_agg(tiempo_promedio_ms ORDER BY sampled_at DESC))[1] AS last_response_ms,
			MAX(sampled_at) AS last_sample
		FROM service_status
		WHERE sampled_at >= now() - interval ${sql.raw(`'${window}'`)}
		GROUP BY servicio, entorno, es_lote
		ORDER BY servicio
	`);

	type KpiRow = {
		servicio: string;
		entorno: string;
		es_lote: boolean;
		availability: number | null;
		last_estado: string | null;
		last_response_ms: number | null;
		last_sample: string | null;
	};

	const kpiRows = kpiResult as unknown as KpiRow[];

	type ChartRow = {
		servicio: string;
		estado: string;
		tiempo_promedio_ms: number;
		sampled_at: string;
	};

	let chartRows: ChartRow[];

	if (bucket) {
		const result = await db.execute(sql`
			SELECT DISTINCT ON (servicio, date_trunc(${sql.raw(`'${bucket}'`)}, sampled_at))
				servicio, estado, tiempo_promedio_ms, sampled_at
			FROM service_status
			WHERE sampled_at >= now() - interval ${sql.raw(`'${window}'`)}
			ORDER BY servicio, date_trunc(${sql.raw(`'${bucket}'`)}, sampled_at), sampled_at DESC
		`);
		chartRows = result as unknown as ChartRow[];
	} else {
		const result = await db.execute(sql`
			SELECT servicio, estado, tiempo_promedio_ms, sampled_at
			FROM service_status
			WHERE sampled_at >= now() - interval ${sql.raw(`'${window}'`)}
			ORDER BY servicio, sampled_at
		`);
		chartRows = result as unknown as ChartRow[];
	}

	const pointsByService = new Map<string, DataPoint[]>();
	for (const row of chartRows) {
		const existing = pointsByService.get(row.servicio) ?? [];
		existing.push({
			status: toHealthStatus(row.estado),
			description: pointDescription(row.estado, row.tiempo_promedio_ms),
			timestamp: new Date(row.sampled_at)
		});
		pointsByService.set(row.servicio, existing);
	}

	let lastSample: Date | null = null;

	const services = kpiRows.map((row) => {
		const date = row.last_sample ? new Date(row.last_sample) : null;
		if (date && (!lastSample || date > lastSample)) {
			lastSample = date;
		}
		return {
			name: row.servicio,
			environment: row.entorno as 'PRODUCCION' | 'TEST',
			isBatch: row.es_lote,
			points: pointsByService.get(row.servicio) ?? [],
			availability: row.availability ?? 0,
			lastEstado: row.last_estado as 'VERDE' | 'AMARILLO' | 'ROJO' | null,
			lastResponseMs: row.last_response_ms
		};
	});

	return { services, lastSample };
});

export const refreshNow = command(async () => {
	await pollAndIngest();
});
