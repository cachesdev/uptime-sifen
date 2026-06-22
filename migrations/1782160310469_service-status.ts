import type { ColumnDefinitions, MigrationBuilder } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('service_status', {
    id: { type: 'bigserial', primaryKey: true },
    sampled_at: { type: 'timestamptz', notNull: true },
    servicio: { type: 'text', notNull: true },
    entorno: { type: 'text', notNull: true, check: "entorno IN ('PRODUCCION', 'TEST')" },
    es_lote: { type: 'boolean', notNull: true },
    estado: { type: 'text', notNull: true, check: "estado IN ('VERDE', 'AMARILLO', 'ROJO')" },
    tiempo_promedio_ms: { type: 'integer', notNull: true }
  });

  pgm.createIndex('service_status', ['servicio', 'sampled_at'], {
    name: 'service_status_servicio_time_idx'
  });

  pgm.createIndex('service_status', ['sampled_at'], { name: 'service_status_time_idx' });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropIndex('service_status', ['sampled_at'], { name: 'service_status_time_idx' });
  pgm.dropIndex('service_status', ['servicio', 'sampled_at'], {
    name: 'service_status_servicio_time_idx'
  });
  pgm.dropTable('service_status');
}
