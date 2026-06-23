import {
  pgTable,
  bigserial,
  serial,
  timestamp,
  varchar,
  text,
  boolean,
  integer,
  index,
  check
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { SifenEnvironment, SifenServiceName } from './enums';

export const pgmigrations = pgTable('pgmigrations', {
  id: serial().primaryKey(),
  name: varchar({ length: 255 }).notNull(),
  runOn: timestamp('run_on').notNull()
});

export const serviceStatus = pgTable(
  'service_status',
  {
    id: bigserial({ mode: 'number' }).primaryKey(),
    sampledAt: timestamp('sampled_at', { withTimezone: true }).notNull(),
    servicio: text().$type<SifenServiceName>().notNull(),
    entorno: text().$type<SifenEnvironment>().notNull(),
    esLote: boolean('es_lote').notNull(),
    estado: text().$type<'VERDE' | 'AMARILLO' | 'ROJO'>().notNull(),
    tiempoPromedioMs: integer('tiempo_promedio_ms').notNull()
  },
  (table) => [
    index('service_status_servicio_entorno_time_idx').using(
      'btree',
      table.servicio.asc().nullsLast(),
      table.entorno.asc().nullsLast(),
      table.sampledAt.asc().nullsLast()
    ),
    index('service_status_time_idx').using('btree', table.sampledAt.asc().nullsLast()),
    check(
      'service_status_servicio_check',
      sql`(servicio = ANY (ARRAY['Envío DE Sincrónico'::text, 'Envío Lote Asincrónico'::text, 'Consulta CDC'::text, 'Consulta Lote'::text, 'Consulta RUC'::text, 'Eventos'::text]))`
    ),
    check(
      'service_status_entorno_check',
      sql`(entorno = ANY (ARRAY['PRODUCCION'::text, 'TEST'::text]))`
    ),
    check(
      'service_status_estado_check',
      sql`(estado = ANY (ARRAY['VERDE'::text, 'AMARILLO'::text, 'ROJO'::text]))`
    )
  ]
);
