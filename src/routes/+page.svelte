<script lang="ts">
  import { dashboardData, refreshNow } from './dashboard.remote';
  import { HealthChart, type HealthChartRange } from '$lib/components/ui/health-chart';
  import * as ToggleGroup from '$lib/components/ui/toggle-group/index.js';
  import * as Card from '$lib/components/ui/card/index.js';
  import { Separator } from '$lib/components/ui/separator/index.js';
  import { Button, PillButton } from '$lib/components/ui/button/index.js';
  import { Skeleton } from '$lib/components/ui/skeleton/index.js';
  import { ArrowClockwiseIcon, SpinnerGapIcon } from 'phosphor-svelte';
  import { DateTime } from 'luxon';

  let range = $state<HealthChartRange>('24h');
  let refreshingManually = $state(false);

  const ranges: Array<{ value: HealthChartRange; label: string }> = [
    { value: '60m', label: '60 min' },
    { value: '24h', label: '24 h' },
    { value: '30d', label: '30 días' },
    { value: '60d', label: '60 días' }
  ];

  function isHealthChartRange(value: string): value is HealthChartRange {
    return ranges.some((range) => range.value === value);
  }

  function getRange(): HealthChartRange {
    return range;
  }

  function setRange(value: string) {
    if (isHealthChartRange(value)) {
      range = value;
    }
  }

  const environments = [
    { value: 'PRODUCCION', label: 'Producción', skeletonTestId: 'produccion-skeleton' },
    { value: 'TEST', label: 'Test', skeletonTestId: 'test-skeleton' }
  ] as const;

  const chartSkeletonBars: Record<HealthChartRange, number> = {
    '60m': 60,
    '24h': 24,
    '30d': 30,
    '60d': 60
  };

  const skeletonCards = [0, 1, 2, 3, 4, 5];

  const statusDotClass: Record<string, string> = {
    VERDE: 'bg-success',
    AMARILLO: 'bg-warning',
    ROJO: 'bg-destructive'
  };

  const statusLabel: Record<string, string> = {
    VERDE: 'Verde',
    AMARILLO: 'Amarillo',
    ROJO: 'Rojo'
  };

  const statusLegend = [
    {
      estado: 'VERDE',
      label: 'Verde',
      dotClass: 'bg-success',
      description:
        'La consulta devolvió una respuesta positiva. Ocurre después de cualquier estado.'
    },
    {
      estado: 'AMARILLO',
      label: 'Amarillo',
      dotClass: 'bg-warning',
      description:
        'Primera respuesta negativa, por falla en el servicio o en la conexión. Si la siguiente es positiva, pasa a verde; si es negativa, pasa a rojo.'
    },
    {
      estado: 'ROJO',
      label: 'Rojo',
      dotClass: 'bg-destructive',
      description:
        'Segunda respuesta negativa consecutiva. Si la siguiente respuesta es positiva, pasa a verde.'
    }
  ] as const;

  function formatDate(date: Date | null): string {
    if (!date) return '—';
    return DateTime.fromJSDate(date).toFormat('dd/MM/yyyy HH:mm');
  }

  function formatAvailability(value: number): string {
    return (value * 100).toFixed(1) + ' %';
  }

  function shortName(name: string): string {
    return name.replace(/\s*-\s*(Producción|Test)\s*$/, '');
  }

  async function waitForDashboardData(range: HealthChartRange): Promise<string> {
    await dashboardData(range);
    return '';
  }

  async function refresh() {
    if (refreshingManually) return;

    refreshingManually = true;
    try {
      await refreshNow();
      await dashboardData(range).refresh();
    } finally {
      refreshingManually = false;
    }
  }
</script>

{#snippet RefreshButton(isUpdating: boolean)}
  <PillButton variant="outline" onclick={refresh} disabled={isUpdating} aria-busy={isUpdating}>
    {#if isUpdating}
      <SpinnerGapIcon data-icon="inline-start" class="animate-spin" aria-hidden="true" />
      <span aria-live="polite">Actualizando</span>
    {:else}
      <ArrowClockwiseIcon data-icon="inline-start" aria-hidden="true" />
      Actualizar
    {/if}
  </PillButton>
{/snippet}

<main class="mx-auto max-w-352 px-6 py-10">
  <header class="flex flex-wrap items-end justify-between gap-4">
    <div>
      <h1 class="text-2xl font-semibold tracking-tight">Estado de servicios SIFEN</h1>
      <div class="mt-1 flex flex-wrap items-center gap-1.5 font-mono text-xs text-muted-foreground">
        <span>Última muestra:</span>
        <svelte:boundary>
          {#snippet pending()}
            <Skeleton
              data-testid="last-sample-skeleton"
              class="h-3 w-32 border-muted bg-muted/60"
            />
          {/snippet}

          {#snippet failed()}
            <span class="text-destructive">No disponible</span>
          {/snippet}

          {const data = $derived(await dashboardData(range))}
          <span>{formatDate(data.lastSample)}</span>
        </svelte:boundary>
      </div>
    </div>

    <div class="flex max-w-full flex-wrap items-center gap-3">
      <ToggleGroup.Root
        type="single"
        variant="outline"
        bind:value={getRange, setRange}
        class="w-full flex-wrap sm:w-fit"
      >
        {#each ranges as r (r.value)}
          <ToggleGroup.Item value={r.value}>{r.label}</ToggleGroup.Item>
        {/each}
      </ToggleGroup.Root>

      <svelte:boundary>
        {#snippet pending()}
          {@render RefreshButton(refreshingManually)}
        {/snippet}

        {await waitForDashboardData(range)}
        {@render RefreshButton(refreshingManually || $effect.pending() > 0)}
      </svelte:boundary>
    </div>
  </header>

  {#each environments as environment, environmentIndex (environment.value)}
    {#if environmentIndex > 0}
      <Separator class="my-10" />
    {/if}

    <section class={environmentIndex === 0 ? 'mt-10' : undefined}>
      <h2 class="mb-4 text-sm font-medium text-muted-foreground">{environment.label}</h2>

      <svelte:boundary>
        {#snippet pending()}
          <div
            data-testid={environment.skeletonTestId}
            aria-busy="true"
            aria-label={`${environment.label} cargando`}
            class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
          >
            {#each skeletonCards as card (card)}
              <Card.Root class="hairline-frame" aria-hidden="true">
                <Card.Header>
                  <div class="flex items-center justify-between gap-2">
                    <Skeleton class="h-4 w-36 bg-muted/80" />
                    <div class="flex items-center gap-1.5">
                      <Skeleton class="size-2 rounded-full bg-muted/80" />
                      <Skeleton class="h-3 w-10 bg-muted/60" />
                    </div>
                  </div>
                </Card.Header>

                <Card.Content>
                  <div class="mb-3 flex items-baseline gap-2">
                    <Skeleton class="h-6 w-20 bg-muted/80" />
                    <Skeleton class="h-3 w-24 bg-muted/60" />
                    <Skeleton class="ml-auto h-3 w-12 bg-muted/50" />
                  </div>

                  <div class="flex h-10 w-full items-end gap-px">
                    {#each { length: chartSkeletonBars[range] }, barIndex}
                      <Skeleton
                        class={barIndex % 5 === 0
                          ? 'h-full min-w-px flex-1 rounded-none border-transparent bg-muted'
                          : 'h-full min-w-px flex-1 rounded-none border-transparent bg-muted/60'}
                      />
                    {/each}
                  </div>
                </Card.Content>
              </Card.Root>
            {/each}
          </div>
        {/snippet}

        {#snippet failed(error, reset)}
          <div class="hairline-frame border border-destructive/30 bg-destructive/5 px-4 py-3">
            <p class="text-sm font-medium text-destructive">
              No se pudo cargar {environment.label.toLowerCase()}.
            </p>
            <p class="mt-1 text-xs text-muted-foreground">
              {error instanceof Error ? error.message : 'Error desconocido'}
            </p>
            <Button class="mt-3" variant="outline" size="sm" onclick={reset}>Reintentar</Button>
          </div>
        {/snippet}

        {const data = $derived(await dashboardData(range))}
        {const services = $derived(
          data.services.filter((service) => service.environment === environment.value)
        )}

        <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {#each services as service (service.name)}
            <Card.Root class="hairline-frame">
              <Card.Header>
                <div class="flex items-center justify-between gap-2">
                  <Card.Title class="text-sm">{shortName(service.name)}</Card.Title>
                  {#if service.lastEstado}
                    <div class="flex items-center gap-1.5">
                      <span class={['size-2 rounded-full', statusDotClass[service.lastEstado]]}
                      ></span>
                      <span class="text-xs">{statusLabel[service.lastEstado]}</span>
                    </div>
                  {/if}
                </div>
              </Card.Header>
              <Card.Content>
                <div class="mb-3 flex items-baseline gap-2">
                  <span class="font-mono text-xl tabular-nums">
                    {formatAvailability(service.availability)}
                  </span>
                  <span class="text-xs text-muted-foreground">disponibilidad</span>
                  {#if service.lastResponseMs !== null}
                    <span class="ml-auto font-mono text-xs text-muted-foreground">
                      {service.lastResponseMs} ms
                    </span>
                  {/if}
                </div>
                <HealthChart data={service.points} {range} emptyText="Sin datos" />
              </Card.Content>
            </Card.Root>
          {/each}
        </div>
      </svelte:boundary>
    </section>
  {/each}

  <section class="mt-16 border-t border-border pt-8">
    <h2 class="mb-6 text-sm font-medium text-muted-foreground">Referencia</h2>

    <div class="mb-8 flex flex-wrap gap-x-10 gap-y-6">
      {#each statusLegend as item (item.estado)}
        <div class="flex items-start gap-3">
          <span class="mt-1.5 size-2.5 shrink-0 rounded-full {item.dotClass}"></span>
          <div>
            <p class="text-sm font-medium text-foreground">{item.label}</p>
            <p class="mt-1 max-w-xs text-sm leading-relaxed text-muted-foreground">
              {item.description}
            </p>
          </div>
        </div>
      {/each}
    </div>

    <p class="max-w-2xl text-sm leading-relaxed text-muted-foreground">
      La disponibilidad se calcula como el porcentaje de muestras con estado verde sobre el total de
      muestras almacenadas en el período seleccionado. Los estados amarillo y rojo se consideran no
      disponibles. Los minutos sin datos, cuando no se pudo consultar el servicio, no afectan el
      cálculo. El muestreo se hace cada minuto.
    </p>
  </section>

  <footer
    class="mt-16 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6 text-xs text-muted-foreground"
  >
    <p>
      Hecho por
      <a
        href="https://github.com/cachesdev"
        class="font-medium text-link underline-offset-4 hover:underline"
        rel="noopener noreferrer"
        target="_blank">Gustavo Dominguez</a
      >
      ·
      <a
        href="https://github.com/cachesdev/uptime-sifen"
        class="font-medium text-link underline-offset-4 hover:underline"
        rel="noopener noreferrer"
        target="_blank">código fuente</a
      >
    </p>
    <p class="font-mono">
      Datos de
      <a
        href="https://semaforo-sifen.dnit.gov.py/"
        class="text-link underline-offset-4 hover:underline"
        rel="noopener noreferrer"
        target="_blank">DNIT · SIFEN</a
      >
    </p>
  </footer>
</main>
