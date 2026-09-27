<script setup lang="ts">
import type { AgendaItem } from '~/utils/agenda'
import { AGENDA_KIND_META, addDays, dayKey } from '~/utils/agenda'
import { pluralRu } from '~/utils/format'

/**
 * Семь дней вперёд одной полосой. Дашборд отвечает за сегодня, но планировать
 * звонок на «послезавтра» менеджер должен, видя, занят ли этот день: полоса
 * показывает плотность, а клик уводит в планнер на нужную дату.
 */
const props = defineProps<{ items: AgendaItem[]; from: Date }>()
const emit = defineEmits<{ pick: [Date] }>()

const WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб']

const days = computed(() => {
  const todayKey = dayKey(new Date())
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(props.from, i)
    const key = dayKey(date)
    const items = props.items.filter((x) => dayKey(x.at) === key)
    const open = items.filter((x) => !x.done)
    // доли по видам дел: полоска под числом показывает, из чего состоит день
    const mix = new Map<string, number>()
    for (const i2 of open) {
      const c = AGENDA_KIND_META[i2.kind].color
      mix.set(c, (mix.get(c) ?? 0) + 1)
    }
    return {
      date, key,
      label: WEEKDAYS[date.getDay()]!,
      today: key === todayKey,
      weekend: [0, 6].includes(date.getDay()),
      count: open.length,
      overdue: open.some((x) => x.overdue),
      mix: [...mix.entries()].map(([color, n]) => ({ color, pct: (n / open.length) * 100 })),
    }
  })
})
</script>

<template>
  <section class="grid grid-cols-4 gap-px overflow-hidden rounded-card border border-line bg-line shadow-card sm:grid-cols-7">
    <button
      v-for="d in days" :key="d.key" type="button"
      class="focus-ring group flex flex-col gap-1.5 bg-panel px-3 py-2.5 text-left transition-colors hover:bg-soft"
      :class="d.weekend ? 'bg-soft/45' : ''"
      @click="emit('pick', d.date)"
    >
      <span class="flex items-baseline gap-1.5">
        <span class="text-[11px] uppercase tracking-[0.04em]" :class="d.today ? 'text-plum' : 'text-muted'">{{ d.label }}</span>
        <span class="tabular text-[15px] font-semibold" :class="d.today ? 'text-plum' : 'text-ink'">{{ d.date.getDate() }}</span>
        <span v-if="d.overdue" class="ml-auto h-1.5 w-1.5 rounded-full bg-fill-bad" title="есть просроченное" />
      </span>

      <span class="flex h-[5px] w-full overflow-hidden rounded-full bg-soft">
        <span v-for="(m, mi) in d.mix" :key="mi" class="block h-full" :style="{ width: `${m.pct}%`, background: m.color }" />
      </span>

      <span class="text-[11.5px]" :class="d.count ? 'text-ink' : 'text-muted'">
        {{ d.count ? `${d.count} ${pluralRu(d.count, 'дело', 'дела', 'дел')}` : 'свободно' }}
      </span>
    </button>
  </section>
</template>
