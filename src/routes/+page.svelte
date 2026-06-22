<script lang="ts">
  import { dashboardData, refreshNow } from './dashboard.remote';
  import { HealthChart, type HealthChartRange } from '$lib/components/ui/health-chart';
  import * as ToggleGroup from '$lib/components/ui/toggle-group/index.js';
  import * as Card from '$lib/components/ui/card/index.js';
  import { Separator } from '$lib/components/ui/separator/index.js';
  import { Button } from '$lib/components/ui/button/index.js';
  import { DateTime } from 'luxon';

  let range = $state<HealthChartRange>('24h');
  let refreshing = $state(false);

  const ranges: Array<{ value: HealthChartRange; label: string }> = [
    { value: '60m', label: '60 min' },
    { value: '24h', label: '24 h' },
    { value: '30d', label: '30 días' },
    { value: '60d', label: '60 días' }
  ];

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

  async function refresh() {
    refreshing = true;
    try {
      await refreshNow();
      void dashboardData(range).refresh();
    } finally {
      refreshing = false;
    }
  }
</script>

<svelte:boundary>
  {#snippet pending()}
    <div class="mx-auto max-w-352 px-6 py-10">
      <div class="h-7 w-72 bg-muted animate-pulse"></div>
      <div class="mt-2 h-4 w-48 bg-muted/50 animate-pulse"></div>
      <div class="mt-8 h-8 w-96 bg-muted/50 animate-pulse"></div>
    </div>
  {/snippet}

  {#snippet failed(error)}
    <div class="mx-auto max-w-352 px-6 py-10">
      <p class="text-sm text-destructive">No se pudo cargar el estado de los servicios.</p>
      <p class="mt-1 text-xs text-muted-foreground">
        {error instanceof Error ? error.message : 'Error desconocido'}
      </p>
    </div>
  {/snippet}

  {const data = $derived(await dashboardData(range))}
  {const production = $derived(data.services.filter((s) => s.environment === 'PRODUCCION'))}
  {const test = $derived(data.services.filter((s) => s.environment === 'TEST'))}

  <main class="mx-auto max-w-352 px-6 py-10">
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">Estado de servicios SIFEN</h1>
        <p class="mt-1 font-mono text-xs text-muted-foreground">
          Última muestra: {formatDate(data.lastSample)}
        </p>
      </div>

      <div class="flex items-center gap-3">
        <ToggleGroup.Root type="single" variant="outline" bind:value={range}>
          {#each ranges as r (r.value)}
            <ToggleGroup.Item value={r.value}>{r.label}</ToggleGroup.Item>
          {/each}
        </ToggleGroup.Root>

        <Button variant="outline" onclick={refresh} disabled={refreshing}>
          {refreshing ? 'Actualizando…' : 'Actualizar'}
        </Button>
      </div>
    </header>

    <section class="mt-10">
      <h2 class="mb-4 text-xs font-medium text-muted-foreground">Producción</h2>
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {#each production as service (service.name)}
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
    </section>

    <Separator class="my-10" />

    <section>
      <h2 class="mb-4 text-xs font-medium text-muted-foreground">Test</h2>
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {#each test as service (service.name)}
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
    </section>
  </main>
</svelte:boundary>
