<script setup lang="ts">
import { moneyCompact } from '~/utils/format'

/**
 * План и факт поступлений. Две марки на месяц: плановая сумма по графику —
 * контуром, фактические поступления — заливкой поверх. Так видно не только
 * «сколько пришло», но и сколько должно было прийти: разрыв между ними и есть
 * кассовый разрыв, ради которого этот график смотрят.
 */
export interface PlanFactPoint {
  label: string
  plan: number
  fact: number
  done: number | null
}

const props = withDefaults(defineProps<{ points: PlanFactPoint[]; height?: number }>(), { height: 180 })

const max = computed(() => Math.max(1, ...props.points.flatMap((p) => [p.plan, p.fact])))

/** «Круглые» деления оси — они несут значения, которые не подписаны прямо. */
const scale = computed(() => {
  const m = max.value
  const pow = 10 ** Math.floor(Math.log10(m || 1))
  const step = [1, 2, 2.5, 5, 10].map((k) => k * pow).find((st) => m / st <= 4) ?? pow * 10
  const top = Math.ceil(m / step) * step
  const ticks: number[] = []
  for (let v = 0; v <= top + step * 0.001; v += step) ticks.push(v)
  return { ticks, top: top || 1 }
})

const hover = ref<number | null>(null)
const totals = computed(() => ({
  plan: props.points.reduce((s, p) => s + p.plan, 0),
  fact: props.points.reduce((s, p) => s + p.fact, 0),
}))
</script>

<template>
  <div>
    <div class="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px]">
      <span class="flex items-center gap-1.5 text-muted">
        <span class="h-2.5 w-2.5 rounded-sm border border-chart-accent bg-chart-accent/20" /> План {{ moneyCompact(totals.plan) }}
      </span>
      <span class="flex items-center gap-1.5 text-muted">
        <span class="h-2.5 w-2.5 rounded-sm bg-chart-accent" /> Факт {{ moneyCompact(totals.fact) }}
      </span>
      <span class="ml-auto tabular font-semibold" :class="totals.fact >= totals.plan ? 'text-ok' : 'text-warn'">
        {{ totals.plan ? Math.round((totals.fact / totals.plan) * 100) : 0 }}% исполнения
      </span>
    </div>

    <div class="relative flex" :style="{ height: `${height + 20}px` }">
      <!-- ось значений -->
      <div class="flex w-[52px] shrink-0 flex-col justify-between pb-5 pr-2 text-right">
        <span v-for="t in [...scale.ticks].reverse()" :key="t" class="tabular text-[10px] leading-none text-muted">
          {{ moneyCompact(t) }}
        </span>
      </div>

      <div class="relative min-w-0 flex-1">
        <!-- сетка -->
        <div class="absolute inset-x-0 bottom-5 top-0 flex flex-col justify-between">
          <span v-for="t in scale.ticks" :key="t" class="h-px w-full bg-chart-grid" />
        </div>

        <div class="relative flex h-full items-end gap-1">
          <div
            v-for="(p, i) in points" :key="p.label" class="group relative flex h-full min-w-0 flex-1 flex-col justify-end"
            @mouseenter="hover = i" @mouseleave="hover = null"
          >
            <div class="relative mb-5 flex h-full items-end justify-center">
              <!-- план: контур -->
              <span
                class="absolute bottom-0 w-full rounded-t-[3px] border border-chart-accent/70 bg-chart-accent/10 transition-all"
                :style="{ height: `${(p.plan / scale.top) * 100}%` }"
              />
              <!-- факт: заливка -->
              <span
                class="absolute bottom-0 w-[58%] rounded-t-[3px] bg-chart-accent transition-all"
                :class="hover === i ? 'opacity-100' : 'opacity-85'"
                :style="{ height: `${(p.fact / scale.top) * 100}%` }"
              />
            </div>
            <span class="absolute inset-x-0 bottom-0 truncate text-center text-[10px] text-muted">{{ p.label }}</span>

            <div
              v-if="hover === i"
              class="pointer-events-none absolute bottom-[calc(100%-12px)] left-1/2 z-10 w-[140px] -translate-x-1/2 rounded-lg border border-line bg-panel px-2.5 py-1.5 text-[11.5px] shadow-pop"
            >
              <p class="font-semibold text-ink">{{ p.label }}</p>
              <p class="tabular text-muted">План {{ moneyCompact(p.plan) }}</p>
              <p class="tabular text-ink">Факт {{ moneyCompact(p.fact) }}</p>
              <p v-if="p.done !== null" class="tabular font-semibold" :class="p.done >= 100 ? 'text-ok' : 'text-warn'">
                {{ p.done }}% исполнения
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
