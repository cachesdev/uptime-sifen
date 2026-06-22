<script lang="ts">
	import { datosDashboard, refrescarAhora } from './dashboard.remote';
	import { HealthChart, type HealthChartRange } from '$lib/components/ui/health-chart';
	import * as ToggleGroup from '$lib/components/ui/toggle-group/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { DateTime } from 'luxon';

	let range = $state<HealthChartRange>('24h');
	let refrescando = $state(false);

	const rangos: Array<{ value: HealthChartRange; label: string }> = [
		{ value: '60m', label: '60 min' },
		{ value: '24h', label: '24 h' },
		{ value: '30d', label: '30 días' },
		{ value: '60d', label: '60 días' }
	];

	const consulta = $derived(datosDashboard(range));

	const puntoEstado: Record<string, string> = {
		VERDE: 'bg-success',
		AMARILLO: 'bg-warning',
		ROJO: 'bg-destructive'
	};

	const etiquetaEstado: Record<string, string> = {
		VERDE: 'Verde',
		AMARILLO: 'Amarillo',
		ROJO: 'Rojo'
	};

	function formatearFecha(date: Date | null): string {
		if (!date) return '—';
		return DateTime.fromJSDate(date).toFormat('dd/MM/yyyy HH:mm');
	}

	function formatearDisponibilidad(valor: number): string {
		return (valor * 100).toFixed(1) + ' %';
	}

	function nombreCorto(nombre: string): string {
		return nombre.replace(/\s*-\s*(Producción|Test)\s*$/, '');
	}

	async function actualizar() {
		refrescando = true;
		try {
			await refrescarAhora().updates(datosDashboard);
		} finally {
			refrescando = false;
		}
	}
</script>

<svelte:boundary>
	{#snippet pending()}
		<div class="mx-auto max-w-[88rem] px-6 py-10">
			<div class="h-7 w-72 bg-muted animate-pulse"></div>
			<div class="mt-2 h-4 w-48 bg-muted/50 animate-pulse"></div>
			<div class="mt-8 h-8 w-96 bg-muted/50 animate-pulse"></div>
		</div>
	{/snippet}

	{#snippet failed(error)}
		<div class="mx-auto max-w-[88rem] px-6 py-10">
			<p class="text-sm text-destructive">No se pudo cargar el estado de los servicios.</p>
			<p class="mt-1 text-xs text-muted-foreground">
				{error instanceof Error ? error.message : 'Error desconocido'}
			</p>
		</div>
	{/snippet}

	{const data = await consulta}
	{const produccion = data.servicios.filter((s) => s.entorno === 'PRODUCCION')}
	{const test = data.servicios.filter((s) => s.entorno === 'TEST')}

	<main class="mx-auto max-w-[88rem] px-6 py-10">
		<header class="flex flex-wrap items-end justify-between gap-4">
			<div>
				<h1 class="text-2xl font-semibold tracking-tight">Estado de servicios SIFEN</h1>
				<p class="mt-1 font-mono text-xs text-muted-foreground">
					Última muestra: {formatearFecha(data.ultimaMuestra)}
				</p>
			</div>

			<div class="flex items-center gap-3">
				<ToggleGroup.Root type="single" variant="outline" bind:value={range}>
					{#each rangos as r (r.value)}
						<ToggleGroup.Item value={r.value}>{r.label}</ToggleGroup.Item>
					{/each}
				</ToggleGroup.Root>

				<Button variant="outline" onclick={actualizar} disabled={refrescando}>
					{refrescando ? 'Actualizando…' : 'Actualizar'}
				</Button>
			</div>
		</header>

		<section class="mt-10">
			<h2 class="mb-4 text-xs font-medium text-muted-foreground">Producción</h2>
			<div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
				{#each produccion as servicio (servicio.nombre)}
					<Card.Root class="hairline-frame">
						<Card.Header>
							<div class="flex items-center justify-between gap-2">
								<Card.Title class="text-sm">{nombreCorto(servicio.nombre)}</Card.Title>
								{#if servicio.ultimoEstado}
									<div class="flex items-center gap-1.5">
										<span class={['size-2 rounded-full', puntoEstado[servicio.ultimoEstado]]}
										></span>
										<span class="text-xs">{etiquetaEstado[servicio.ultimoEstado]}</span>
									</div>
								{/if}
							</div>
						</Card.Header>
						<Card.Content>
							<div class="mb-3 flex items-baseline gap-2">
								<span class="font-mono text-xl tabular-nums">
									{formatearDisponibilidad(servicio.disponibilidad)}
								</span>
								<span class="text-xs text-muted-foreground">disponibilidad</span>
								{#if servicio.ultimoTiempoMs !== null}
									<span class="ml-auto font-mono text-xs text-muted-foreground">
										{servicio.ultimoTiempoMs} ms
									</span>
								{/if}
							</div>
							<HealthChart data={servicio.puntos} {range} emptyText="Sin datos" />
						</Card.Content>
					</Card.Root>
				{/each}
			</div>
		</section>

		<Separator class="my-10" />

		<section>
			<h2 class="mb-4 text-xs font-medium text-muted-foreground">Test</h2>
			<div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
				{#each test as servicio (servicio.nombre)}
					<Card.Root class="hairline-frame">
						<Card.Header>
							<div class="flex items-center justify-between gap-2">
								<Card.Title class="text-sm">{nombreCorto(servicio.nombre)}</Card.Title>
								{#if servicio.ultimoEstado}
									<div class="flex items-center gap-1.5">
										<span class={['size-2 rounded-full', puntoEstado[servicio.ultimoEstado]]}
										></span>
										<span class="text-xs">{etiquetaEstado[servicio.ultimoEstado]}</span>
									</div>
								{/if}
							</div>
						</Card.Header>
						<Card.Content>
							<div class="mb-3 flex items-baseline gap-2">
								<span class="font-mono text-xl tabular-nums">
									{formatearDisponibilidad(servicio.disponibilidad)}
								</span>
								<span class="text-xs text-muted-foreground">disponibilidad</span>
								{#if servicio.ultimoTiempoMs !== null}
									<span class="ml-auto font-mono text-xs text-muted-foreground">
										{servicio.ultimoTiempoMs} ms
									</span>
								{/if}
							</div>
							<HealthChart data={servicio.puntos} {range} emptyText="Sin datos" />
						</Card.Content>
					</Card.Root>
				{/each}
			</div>
		</section>
	</main>
</svelte:boundary>
