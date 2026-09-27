<script setup lang="ts">
import type { RankedRow } from '~/utils/analytics'

/**
 * Ранжированный список: ЖК, менеджеры, источники. Горизонтальные бары, а не
 * круг: сравнивать длину полос человек умеет, доли сектора — нет. Значения
 * подписаны прямо на строке, поэтому оси не нужны.
 */
const props = withDefaults(defineProps<{
  rows: RankedRow[]
  formatValue?: (v: number) => string
  /** подпись второй величины: «сделок», «в сделку» */
  secondaryLabel?: string
  limit?: number
  tone?: 'accent' | 'ok' | 'muted'
}>(), { limit: 6, tone: 'accent' })

const shown = computed(() => props.rows.slice(0, props.limit))
const max = computed(() => Math.max(1, ...shown.value.map((r) => r.value)))
const fmt = (v: number) => (props.formatValue ? props.formatValue(v) : v.toLocaleString('ru-RU'))

const fill = computed(() => ({ accent: 'bg-chart-accent', ok: 'bg-fill-ok', muted: 'bg-muted' }[props.tone]))
const track = computed(() => ({ accent: 'bg-chart-accent/12', ok: 'bg-fill-ok/12', muted: 'bg-muted/12' }[props.tone]))
</script>

<template>
  <div v-if="shown.length" class="flex flex-col gap-2.5">
    <div v-for="r in shown" :key="r.key">
      <div class="flex items-baseline justify-between gap-3">
        <p class="min-w-0 truncate text-[12.5px] text-ink">{{ r.label }}</p>
        <p class="tabular shrink-0 text-[12.5px] font-semibold text-ink">
          {{ fmt(r.value) }}
          <span v-if="r.secondary !== undefined" class="font-normal text-muted">
            · {{ r.secondary }}{{ secondaryLabel ? ` ${secondaryLabel}` : '' }}
          </span>
        </p>
      </div>
      <div class="mt-1 flex items-center gap-2">
        <div class="h-[6px] flex-1 overflow-hidden rounded-full" :class="track">
          <span class="block h-full rounded-full transition-all" :class="fill" :style="{ width: `${(r.value / max) * 100}%` }" />
        </div>
        <span v-if="r.hint" class="shrink-0 text-[11px] text-muted">{{ r.hint }}</span>
      </div>
    </div>
  </div>
  <EmptyState v-else compact icon="ph:chart-bar" title="Нет данных за период" />
</template>
