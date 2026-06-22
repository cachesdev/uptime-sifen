<script module lang="ts">
	export type HealthChartStatus = 'red' | 'orange' | 'green' | 'gray';
	export type HealthChartRange = '60m' | '24h' | '30d' | '60d';

	export type DataPoint = {
		status: HealthChartStatus;
		description: string;
		timestamp: Date;
	};
</script>

<script lang="ts">
	import * as Tooltip from '../tooltip/index.js';
	import { cn } from '../../../utils.js';
	import { DateTime, Duration, Interval } from 'luxon';
	import type { SvelteHTMLElements } from 'svelte/elements';

	type RangeConfig = {
		count: number;
		unit: Duration;
		latestStart: DateTime;
	};

	type Bucket = {
		start: DateTime;
		end: DateTime;
		point?: DataPoint;
	};

	type Props = Omit<SvelteHTMLElements['div'], 'children'> & {
		data?: Array<DataPoint>;
		range?: HealthChartRange;
		emptyStatus?: HealthChartStatus;
		emptyText?: string;
	};

	let {
		data = [],
		range = '60d',
		emptyStatus = 'gray',
		emptyText = 'No data',
		class: className,
		...restProps
	}: Props = $props();

	const statusClasses: Record<HealthChartStatus, string> = {
		green: 'bg-success/80 hover:bg-success data-[state=open]:bg-success',
		orange: 'bg-warning/85 hover:bg-warning data-[state=open]:bg-warning',
		red: 'bg-destructive/85 hover:bg-destructive data-[state=open]:bg-destructive',
		gray: 'bg-muted-foreground/25 hover:bg-muted-foreground/35 data-[state=open]:bg-muted-foreground/35'
	};

	function getRangeConfig(range: HealthChartRange): RangeConfig {
		const now = DateTime.now();

		switch (range) {
			case '60m':
				return {
					count: 60,
					unit: Duration.fromObject({ minute: 1 }),
					latestStart: now.startOf('minute')
				};
			case '24h':
				return {
					count: 24,
					unit: Duration.fromObject({ hour: 1 }),
					latestStart: now.startOf('hour')
				};
			case '30d':
				return {
					count: 30,
					unit: Duration.fromObject({ day: 1 }),
					latestStart: now.startOf('day')
				};
			case '60d':
				return {
					count: 60,
					unit: Duration.fromObject({ day: 1 }),
					latestStart: now.startOf('day')
				};
		}
	}

	function scaleDuration(duration: Duration, amount: number): Duration {
		return duration.mapUnits((value) => value * amount);
	}

	function isInBucket(timestamp: Date, bucket: Bucket) {
		return Interval.fromDateTimes(bucket.start, bucket.end).contains(
			DateTime.fromJSDate(timestamp)
		);
	}

	function formatBucketLabel(bucket: Bucket) {
		const dateTimeFormat = "d LLLL yyyy 'at' HH:mm";
		const dateFormat = 'd LLLL yyyy';
		const timeFormat = 'HH:mm';

		if (bucket.point) {
			return DateTime.fromJSDate(bucket.point.timestamp).toFormat(dateTimeFormat);
		}

		if (range === '60m' || range === '24h') {
			if (bucket.start.hasSame(bucket.end, 'day')) {
				return `${bucket.start.toFormat(dateTimeFormat)} - ${bucket.end.toFormat(timeFormat)}`;
			}

			return `${bucket.start.toFormat(dateTimeFormat)} - ${bucket.end.toFormat(dateTimeFormat)}`;
		}

		return bucket.start.toFormat(dateFormat);
	}

	const buckets = $derived.by(() => {
		const { count, unit, latestStart } = getRangeConfig(range);
		const oldestStart = latestStart.minus(scaleDuration(unit, count - 1));
		const newestFirst = data
			.toSorted((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
			.toReversed();

		return Array.from({ length: count }, (_, i): Bucket => {
			const start = oldestStart.plus(scaleDuration(unit, i));
			const bucket = {
				start,
				end: start.plus(unit)
			};

			const point = newestFirst.find((point) => isInBucket(point.timestamp, bucket));

			return {
				...bucket,
				point
			};
		});
	});
</script>

<Tooltip.Provider delayDuration={80} skipDelayDuration={300}>
	<div
		data-slot="health-chart"
		data-range={range}
		class={cn('flex h-10 w-full items-end gap-px', className)}
		{...restProps}
	>
		{#each buckets as bucket (bucket.start.toMillis())}
			{const status = bucket.point?.status ?? emptyStatus}
			{const dateLabel = formatBucketLabel(bucket)}
			{const description = bucket.point?.description ?? emptyText}
			{const datetime =
				(bucket.point ? DateTime.fromJSDate(bucket.point.timestamp) : bucket.start).toISO() ??
				undefined}

			<Tooltip.Root>
				<Tooltip.Trigger
					type="button"
					aria-label={`${dateLabel}: ${description}`}
					data-health-chart-bar
					data-status={status}
					data-empty={bucket.point ? undefined : true}
					tabindex={bucket.point ? 0 : -1}
					class={cn(
						'h-full min-w-px flex-1 cursor-default border border-transparent p-0 opacity-90 transition-[background-color,opacity,transform] duration-200 hover:opacity-100 focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 data-[state=open]:opacity-100',
						statusClasses[status]
					)}
				/>
				<Tooltip.Content
					sideOffset={6}
					class="hairline-frame max-w-64 flex-col items-start gap-1.5 px-2.5 py-2 text-left leading-relaxed"
				>
					<time {datetime} class="font-mono text-[11px]/none text-muted-foreground">
						{dateLabel}
					</time>
					<p class="max-w-60 text-xs/relaxed font-medium text-popover-foreground">
						{description}
					</p>
				</Tooltip.Content>
			</Tooltip.Root>
		{/each}
	</div>
</Tooltip.Provider>
