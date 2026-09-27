<script setup lang="ts">
// Полоса показателей: одна панель, ячейки разделены волосяными линиями.
// Раньше это были четыре отдельные плавающие карточки — они давали всем цифрам
// одинаковый вес и ни одна не читалась как главная. Здесь ровно одна ячейка
// hero (>=48px), остальные подчинены ей.
//
// Разделители получаются из gap-px на фоне цвета линии: так сетка остаётся
// волосяной при любом переносе строк, без border-ов на каждой ячейке.
export interface MetricItem {
  key: string
  label: string
  value: string
  /** единица/валюта — мелким кеглем рядом со значением */
  unit?: string
  hint?: string
  /** dir — куда изменилось, good — хорошо ли это (цвет = направление × смысл) */
  delta?: { text: string; dir: 'up' | 'down'; good: boolean }
  spark?: number[]
  /** доля 0..100 — тонкий индикатор вместо спарклайна там, где истории нет */
  meter?: { pct: number; caption?: string }
  tone?: 'accent' | 'ok' | 'bad' | 'muted'
  /**
   * Цвет самого значения. Нужен там, где цифра сама по себе плохая новость:
   * просрочка и горящие брони должны читаться как тревога, а не как ещё одно
   * число в ряду. Для нейтральных показателей не задаём — цвет без смысла
   * превращает полосу в светофор, где не видно главного.
   */
  valueTone?: 'ok' | 'warn' | 'bad'
  hero?: boolean
  to?: string
}

const props = defineProps<{ items: MetricItem[] }>()

// hero занимает две колонки, поэтому число колонок считаем по «весу» ячеек,
// иначе в конце полосы остаётся пустая клетка цвета линии
const toneFill: Record<string, string> = { accent: 'bg-chart-accent', ok: 'bg-fill-ok', bad: 'bg-fill-bad', muted: 'bg-muted' }
const toneTrack: Record<string, string> = { accent: 'bg-chart-accent/15', ok: 'bg-fill-ok/15', bad: 'bg-fill-bad/15', muted: 'bg-muted/15' }

const COLS: Record<number, string> = {
  2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4',
  5: 'lg:grid-cols-5', 6: 'lg:grid-cols-6', 7: 'lg:grid-cols-7',
}
const gridClass = computed(() => {
  const weight = props.items.reduce((n, m) => n + (m.hero ? 2 : 1), 0)
  return COLS[Math.min(Math.max(weight, 2), 7)] ?? 'lg:grid-cols-4'
})
</script>

<template>
  <section class="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line shadow-card" :class="gridClass">
    <component
      :is="m.to ? 'NuxtLink' : 'div'" v-for="m in items" :key="m.key" :to="m.to"
      class="group flex flex-col bg-panel px-4 py-3.5 transition-colors"
      :class="[m.hero ? 'col-span-2 lg:row-span-1' : '', m.to ? 'hover:bg-soft' : '']"
    >
      <div class="flex items-start justify-between gap-2">
        <p class="min-h-[28px] text-[11px] font-medium uppercase leading-[1.25] tracking-[0.04em] text-muted">{{ m.label }}</p>
        <Icon v-if="m.to" name="ph:arrow-up-right" size="12" class="mt-0.5 shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100" />
      </div>

      <!-- пропорциональные цифры: tabular-nums на крупном значении делает
           число разреженным, он нужен только в столбцах таблиц -->
      <p
        class="mt-1.5 flex items-baseline gap-1.5 font-semibold"
        :class="[
          m.hero ? 'text-[48px] leading-[1.03] tracking-[-0.035em]' : 'text-[25px] leading-[1.1] tracking-[-0.025em]',
          m.valueTone === 'ok' ? 'text-ok' : m.valueTone === 'warn' ? 'text-warn' : m.valueTone === 'bad' ? 'text-bad' : 'text-ink',
        ]"
      >
        {{ m.value }}
        <span v-if="m.unit" class="text-[13px] font-medium tracking-normal text-muted">{{ m.unit }}</span>
      </p>

      <div v-if="m.delta || m.hint" class="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span
          v-if="m.delta" class="flex items-center gap-0.5 text-[11.5px] font-semibold"
          :class="m.delta.good ? 'text-ok' : 'text-bad'"
        >
          <Icon :name="m.delta.dir === 'up' ? 'ph:arrow-up' : 'ph:arrow-down'" size="11" />{{ m.delta.text }}
        </span>
        <span v-if="m.hint" class="text-[11.5px] text-muted">{{ m.hint }}</span>
      </div>

      <div v-if="m.spark?.length" class="mt-auto pt-3">
        <Sparkline :values="m.spark" :tone="m.tone ?? 'accent'" :height="m.hero ? 46 : 30" />
      </div>
      <!-- дорожка индикатора — светлый шаг того же тона, а не серый нейтрал -->
      <div v-else-if="m.meter" class="mt-auto pt-3">
        <div class="h-[5px] overflow-hidden rounded-full" :class="toneTrack[m.tone ?? 'accent']">
          <span class="block h-full rounded-full" :class="toneFill[m.tone ?? 'accent']" :style="{ width: `${Math.min(100, Math.max(0, m.meter.pct))}%` }" />
        </div>
        <p v-if="m.meter.caption" class="mt-1.5 text-[11px] text-muted">{{ m.meter.caption }}</p>
      </div>
    </component>
  </section>
</template>
