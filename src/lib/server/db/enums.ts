export const SIFEN_SERVICE_NAMES = [
  'Envío DE Sincrónico',
  'Envío Lote Asincrónico',
  'Consulta CDC',
  'Consulta Lote',
  'Consulta RUC',
  'Eventos'
] as const;

export type SifenServiceName = (typeof SIFEN_SERVICE_NAMES)[number];

export const SIFEN_ENVIRONMENTS = ['PRODUCCION', 'TEST'] as const;

export type SifenEnvironment = (typeof SIFEN_ENVIRONMENTS)[number];
