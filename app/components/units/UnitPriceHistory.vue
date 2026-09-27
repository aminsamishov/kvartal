<script setup lang="ts">
import type { Unit } from '~/types/models'
import { UNIT_STATUS_META } from '~/utils/meta'
import { fmtDate, money, moneyCompact } from '~/utils/format'

/**
 * История цены помещения. Ступенчатая линия, а не плавная: цена не «росла
 * постепенно», она менялась в конкретные дни конкретными людьми — и именно
 * это менеджер объясняет клиенту, который спрашивает, почему в марте было
 * дешевле.
 */
const props = defineProps<{ unit: Unit }>()

const unitsStore = useUnitsStore()

const entries = computed(() => unitsStore.historyFor(props.unit.id))
const priceEntries = computed(() => entries.value
  .filter((h) => h.kind === 'price')
  .slice()
  .sort((a, b) => a.at.localeCompare(b.at)))

/** Точки линии: стартовая цена, каждое изменение и текущее значение. */
const points = computed(() => {
  const list = priceEntries.value
  if (!list.length) return []
  const out = [{ at: list[0]!.at, price: Number(list[0]!.from ?? 0) }]
  for (const h of list) out.push({ at: h.at, price: Number(h.to ?? 0) })
  // сегодняшнюю точку добавляем всегда: без неё последнее изменение
  // приходится ровно на правый край и «полка» текущей цены не видна
  out.push({ at: new Date().toISOString(), price: props.unit.price })
  return out.filter((p) => Number.isFinite(p.price) && p.price > 0)
})

const range = computed(() => {
  const prices = points.value.map((p) => p.price)
  if (!prices.length) return null
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  // «плоская» история не должна превращаться в линию по центру с нулевым
  // размахом — иначе непонятно, что цена вообще не менялась
  const pad = max === min ? Math.max(max * 0.05, 1) : (max - min) * 0.18
  return { min: min - pad, max: max + pad }
})

const W = 100
const H = 34

/** Ступенчатый путь в процентах ширины: горизонталь до даты, потом скачок. */
const path = computed(() => {
  const r = range.value
  const pts = points.value
  if (!r || pts.length < 2) return ''
  const t0 = new Date(pts[0]!.at).getTime()
  const t1 = new Date(pts[pts.length - 1]!.at).getTime()
  const span = Math.max(1, t1 - t0)
  const x = (at: string) => ((new Date(at).getTime() - t0) / span) * W
  const y = (price: number) => H - ((price - r.min) / (r.max - r.min)) * H

  let d = `M ${x(pts[0]!.at).toFixed(2)} ${y(pts[0]!.price).toFixed(2)}`
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i]!
    d += ` L ${x(p.at).toFixed(2)} ${y(pts[i - 1]!.price).toFixed(2)}`
    d += ` L ${x(p.at).toFixed(2)} ${y(p.price).toFixed(2)}`
  }
  return d
})

const first = computed(() => points.value[0]?.price ?? props.unit.price)
const growth = computed(() => {
  if (!first.value) return 0
  return Math.round(((props.unit.price - first.value) / first.value) * 100)
})

const statusEntries = computed(() => entries.value.filter((h) => h.kind !== 'price'))
const showAll = ref(false)
const shownEntries = computed(() => (showAll.value ? entries.value : entries.value.slice(0, 6)))

function deltaOf(from?: string, to?: string) {
  const a = Number(from)
  const b = Number(to)
  if (!Number.isFinite(a) || !Number.isFinite(b) || !a) return null
  return { abs: b - a, pct: Math.round(((b - a) / a) * 100) }
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- график -->
    <div v-if="points.length >= 2" class="rounded-card border border-line p-3">
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="text-[11px] font-semibold uppercase tracking-[0.04em] text-muted">Цена с начала продаж</p>
          <p class="tabular mt-1 text-[17px] font-semibold leading-none text-ink">{{ money(unit.price) }}</p>
        </div>
        <div class="text-right">
          <p
            class="tabular text-[13px] font-semibold"
            :class="growth > 0 ? 'text-ok' : growth < 0 ? 'text-bad' : 'text-muted'"
          >
            {{ growth > 0 ? '+' : '' }}{{ growth }}%
          </p>
          <p class="tabular text-[11px] text-muted">старт {{ moneyCompact(first) }}</p>
        </div>
      </div>

      <svg class="mt-2 w-full" :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none" style="height: 56px">
        <path :d="path" fill="none" stroke="var(--c-accent)" stroke-width="1.6" vector-effect="non-scaling-stroke" />
      </svg>
      <div class="flex justify-between text-[10.5px] text-muted">
        <span>{{ fmtDate(points[0]!.at) }}</span>
        <span>сегодня</span>
      </div>
    </div>

    <p v-else class="rounded-card border border-dashed border-line px-3 py-2.5 text-[12.5px] text-muted">
      Цена не менялась с момента добавления помещения
    </p>

    <!-- лента изменений -->
    <div v-if="entries.length" class="flex flex-col gap-1.5">
      <div
        v-for="h in shownEntries" :key="h.id"
        class="flex items-center gap-2.5 rounded-xl2 border border-line px-2.5 py-2"
      >
        <span
          class="grid h-6 w-6 shrink-0 place-items-center rounded-lg"
          :class="h.kind === 'price' ? 'bg-plum-soft text-plum' : 'bg-soft text-muted'"
        >
          <Icon :name="h.kind === 'price' ? 'ph:tag' : h.kind === 'status' ? 'ph:swap' : 'ph:file-text'" size="12" />
        </span>

        <div class="min-w-0 flex-1">
          <p class="truncate text-[12.5px] text-ink">
            <template v-if="h.kind === 'price'">
              <span class="tabular text-muted line-through">{{ money(Number(h.from)) }}</span>
              <span class="mx-1 text-muted">→</span>
              <span class="tabular font-semibold">{{ money(Number(h.to)) }}</span>
            </template>
            <template v-else-if="h.kind === 'status'">
              Статус: {{ UNIT_STATUS_META[(h.from ?? 'free') as keyof typeof UNIT_STATUS_META]?.label ?? h.from }}
              → {{ UNIT_STATUS_META[(h.to ?? 'free') as keyof typeof UNIT_STATUS_META]?.label ?? h.to }}
            </template>
            <template v-else>{{ h.note ?? h.kind }}</template>
          </p>
          <p class="truncate text-[11px] text-muted">{{ fmtDate(h.at) }} · {{ h.author }}<template v-if="h.note"> · {{ h.note }}</template></p>
        </div>

        <span
          v-if="h.kind === 'price' && deltaOf(h.from, h.to)"
          class="tabular shrink-0 rounded px-1.5 py-0.5 text-[11px] font-bold"
          :class="deltaOf(h.from, h.to)!.abs > 0 ? 'bg-ok-bg text-ok' : 'bg-bad-bg text-bad'"
        >
          {{ deltaOf(h.from, h.to)!.abs > 0 ? '+' : '' }}{{ deltaOf(h.from, h.to)!.pct }}%
        </span>
      </div>

      <button
        v-if="entries.length > 6" type="button"
        class="focus-ring rounded-xl2 border border-dashed border-line py-1.5 text-[12px] font-medium text-muted hover:border-plum hover:text-plum"
        @click="showAll = !showAll"
      >
        {{ showAll ? 'Свернуть' : `Показать все ${entries.length}` }}
      </button>
    </div>

    <p v-if="statusEntries.length === 0 && entries.length" class="text-[11.5px] text-muted">
      Смен статуса не было — помещение с начала продаж в текущем состоянии.
    </p>
  </div>
</template>
