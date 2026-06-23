import { db } from './db';
import { serviceStatus } from './db/schema';
import { sql } from 'drizzle-orm';
import * as v from 'valibot';
import type { SifenEnvironment, SifenServiceName } from './db/enums';

export type Estado = 'VERDE' | 'AMARILLO' | 'ROJO';
export type Entorno = SifenEnvironment;

const SIFEN_ENDPOINT = 'https://semaforo-sifen.dnit.gov.py/semafororest/estado';
const ENVIRONMENT_SUFFIX = /\s*-\s*(Producción|Produccion|Test)\s*$/i;

const SERVICE_NAMES_BY_UPSTREAM_LABEL: Record<string, SifenServiceName> = {
  asicronico: 'Envío Lote Asincrónico',
  asincronico: 'Envío Lote Asincrónico',
  sincronico: 'Envío DE Sincrónico',
  'consulta cdc': 'Consulta CDC',
  'consulta lote': 'Consulta Lote',
  'consulta ruc': 'Consulta RUC',
  evento: 'Eventos',
  eventos: 'Eventos'
};

function toLookupKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('es-PY');
}

const sifenResponseSchema = v.object({
  data: v.array(
    v.pipe(
      v.object({
        nombreServicio: v.string(),
        estado: v.picklist(['VERDE', 'AMARILLO', 'ROJO']),
        esLote: v.picklist(['S', 'N']),
        tiempoPromedio: v.number()
      }),
      v.transform((service) => {
        const serviceKey = toLookupKey(
          service.nombreServicio.replace(ENVIRONMENT_SUFFIX, '').trim()
        );
        const environmentKey = toLookupKey(
          service.nombreServicio.match(ENVIRONMENT_SUFFIX)?.[1] ?? ''
        );

        const servicio = SERVICE_NAMES_BY_UPSTREAM_LABEL[serviceKey];
        let entorno: SifenEnvironment | null = null;

        if (environmentKey === 'produccion') {
          entorno = 'PRODUCCION';
        } else if (environmentKey === 'test') {
          entorno = 'TEST';
        }

        if (!servicio || !entorno) {
          throw new Error(`Unknown SIFEN service name: ${service.nombreServicio}`);
        }

        return { ...service, servicio, entorno };
      })
    )
  ),
  mensaje: v.string()
});

export type SifenResponse = v.InferOutput<typeof sifenResponseSchema>;
export type SifenService = SifenResponse['data'][number];

export async function fetchSifenStatus(): Promise<SifenResponse | null> {
  try {
    const res = await fetch(SIFEN_ENDPOINT, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15_000)
    });

    if (!res.ok) return null;

    return v.parse(sifenResponseSchema, await res.json());
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
        servicio: s.servicio,
        entorno: s.entorno,
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
