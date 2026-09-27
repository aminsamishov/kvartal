<script setup lang="ts">
import type { AgendaItem } from '~/utils/agenda'
import { AGENDA_KIND_META, addDays, dayKey, startOfWeek } from '~/utils/agenda'
import { fmtMonthYear } from '~/utils/format'

/**
 * Навигатор по месяцам в боковой колонке планнера. Нужен не для чтения дел, а
 * для прыжка: под числом стоят точки по видам дел, поэтому загруженный день
 * виден до того, как в него зашли.
 */
const props = defineProps<{ month: Date; cursor: Date; items: AgendaItem[] }>()
const emit = defineEmits<{ pick: [Date]; 'update:month': [Date] }>()

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

// месяц листается отдельно от выбранного дня — можно заглянуть вперёд, не
// сдвигая рабочий день. Значением владеет страница: под пролистанный месяц
// ей нужно пересобрать повестку, иначе точки нагрузки окажутся пустыми.
function shiftMonth(n: number) {
  emit('update:month', new Date(props.month.getFullYear(), props.month.getMonth() + n, 1))
}

const monthLabel = computed(() => fmtMonthYear(props.month))

/** Нагрузка дня: виды дел в порядке появления, максимум три точки. */
const load = computed(() => {
  const map = new Map<string, string[]>()
  for (const i of props.items) {
    const key = dayKey(i.at)
    const list = map.get(key) ?? []
    const color = AGENDA_KIND_META[i.kind].color
    if (!list.includes(color) && list.length < 3) list.push(color)
    map.set(key, list)
  }
  return map
})

const cells = computed(() => {
  const first = startOfWeek(props.month)
  const todayKey = dayKey(new Date())
  const cursorKey = dayKey(props.cursor)
  return Array.from({ length: 42 }, (_, i) => {
    const date = addDays(first, i)
    const key = dayKey(date)
    return {
      date, key,
      day: date.getDate(),
      outside: date.getMonth() !== props.month.getMonth(),
      today: key === todayKey,
      active: key === cursorKey,
      dots: load.value.get(key) ?? [],
    }
  })
})
</script>

<template>
  <div class="rounded-card border border-line bg-panel p-3 shadow-card">
    <header class="mb-2 flex items-center justify-between gap-1">
      <button class="focus-ring grid h-6 w-6 place-items-center rounded-lg text-muted hover:bg-soft hover:text-ink" @click="shiftMonth(-1)">
        <Icon name="ph:caret-left" size="13" />
      </button>
      <p class="text-[12.5px] font-semibold text-ink">{{ monthLabel }}</p>
      <button class="focus-ring grid h-6 w-6 place-items-center rounded-lg text-muted hover:bg-soft hover:text-ink" @click="shiftMonth(1)">
        <Icon name="ph:caret-right" size="13" />
      </button>
    </header>

    <div class="grid grid-cols-7 gap-y-0.5">
      <span v-for="w in WEEKDAYS" :key="w" class="pb-1 text-center text-[10px] font-medium uppercase tracking-[0.03em] text-muted">{{ w }}</span>

      <button
        v-for="c in cells" :key="c.key" type="button"
        class="focus-ring group relative mx-auto flex h-[27px] w-[27px] flex-col items-center justify-center rounded-lg text-[11.5px] transition-colors"
        :class="[
          c.active ? 'bg-ink font-semibold text-panel'
          : c.today ? 'font-semibold text-plum ring-1 ring-inset ring-plum'
          : c.outside ? 'text-muted/50 hover:bg-soft' : 'text-ink hover:bg-soft',
        ]"
        @click="emit('pick', c.date)"
      >
        <span class="leading-none">{{ c.day }}</span>
        <span class="mt-[3px] flex h-[3px] items-center gap-[2px]">
          <span
            v-for="(color, di) in c.dots" :key="di" class="h-[3px] w-[3px] rounded-full"
            :style="{ background: c.active ? 'currentColor' : color }"
          />
        </span>
      </button>
    </div>
  </div>
</template>
