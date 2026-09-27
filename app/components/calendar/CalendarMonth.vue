<script setup lang="ts">
import type { AgendaItem } from '~/utils/agenda'
import { AGENDA_KIND_META, addDays, dayKey, startOfWeek } from '~/utils/agenda'
import { moneyCompact } from '~/utils/format'

/**
 * Месяц. Не рабочая сетка, а карта загрузки: сюда смотрят, когда планируют
 * отпуск, считают показы за месяц и ищут свободную неделю. Внутри дня —
 * не все дела, а первые три и счётчик: колонка на тридцать строк нечитаема.
 */
const props = defineProps<{ month: Date; items: AgendaItem[] }>()
const emit = defineEmits<{
  open: [AgendaItem]
  pickDay: [Date]
  slot: [Date]
  /** перенос задачи на другой день; час остаётся прежним */
  move: [{ item: AgendaItem; at: Date }]
}>()

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const SHOWN = 3

const weeks = computed(() => {
  const first = startOfWeek(new Date(props.month.getFullYear(), props.month.getMonth(), 1))
  const todayKey = dayKey(new Date())
  // шесть недель всегда: сетка не должна прыгать по высоте от месяца к месяцу
  return Array.from({ length: 6 }, (_, w) => Array.from({ length: 7 }, (_, d) => {
    const date = addDays(first, w * 7 + d)
    const key = dayKey(date)
    const items = props.items.filter((i) => dayKey(i.at) === key)
    return {
      date, key, items,
      day: date.getDate(),
      outside: date.getMonth() !== props.month.getMonth(),
      today: key === todayKey,
      weekend: d >= 5,
      money: items.filter((i) => i.kind === 'payment').reduce((s, i) => s + (i.amount ?? 0), 0),
    }
  }))
})

function hhmm(iso: string) {
  return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

/* ------------------------------ перенос мышью ----------------------------- */

// в месяце меняется только дата: час задачи менеджер выставил осознанно, и
// таскание по карте месяца не повод его сбивать
const drag = ref<AgendaItem | null>(null)
const over = ref<string | null>(null)

function canDrag(item: AgendaItem) {
  return !!item.taskId && !item.done
}
function onDragStart(item: AgendaItem, ev: DragEvent) {
  if (!canDrag(item)) return
  drag.value = item
  if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'move'
}
function onDrop(date: Date) {
  if (!drag.value) return
  const src = new Date(drag.value.at)
  const at = new Date(date)
  at.setHours(src.getHours(), src.getMinutes(), 0, 0)
  emit('move', { item: drag.value, at })
  drag.value = null
  over.value = null
}
</script>

<template>
  <div class="overflow-hidden rounded-card border border-line bg-line shadow-card">
    <div class="grid grid-cols-7 gap-px bg-line">
      <div v-for="w in WEEKDAYS" :key="w" class="bg-panel py-1.5 text-center text-[10.5px] font-medium uppercase tracking-[0.04em] text-muted">
        {{ w }}
      </div>

      <template v-for="(week, wi) in weeks" :key="wi">
        <div
          v-for="c in week" :key="c.key"
          class="group flex min-h-[112px] flex-col gap-1 bg-panel p-1.5 transition-colors hover:bg-soft/60"
          :class="[c.weekend ? 'bg-soft/40' : '', drag && over === c.key ? 'ring-1 ring-inset ring-plum' : '']"
          @dragover.prevent="over = c.key"
          @drop.prevent="onDrop(c.date)"
        >
          <header class="flex items-center gap-1">
            <button
              type="button"
              class="focus-ring grid h-[22px] min-w-[22px] place-items-center rounded-full px-1 text-[12px] font-semibold transition-colors"
              :class="[
                c.today ? 'bg-fill-plum text-white'
                : c.outside ? 'text-muted/55 hover:bg-soft' : 'text-ink hover:bg-soft',
              ]"
              title="Открыть день"
              @click="emit('pickDay', c.date)"
            >{{ c.day }}</button>

            <span class="ml-auto flex shrink-0 items-center gap-1">
              <span v-if="c.money >= 1000" class="tabular text-[10px] font-semibold text-mod-finance">
                {{ moneyCompact(c.money) }}
              </span>
              <button
                type="button"
                class="focus-ring grid h-5 w-5 place-items-center rounded text-muted opacity-0 transition-opacity hover:bg-soft hover:text-plum group-hover:opacity-100"
                title="Запланировать задачу"
                @click="emit('slot', c.date)"
              ><Icon name="ph:plus" size="12" /></button>
            </span>
          </header>

          <button
            v-for="i in c.items.slice(0, SHOWN)" :key="i.id" type="button"
            class="focus-ring flex min-w-0 items-center gap-1 rounded px-1 py-[3px] text-left transition-colors hover:bg-soft"
            :class="[i.done ? 'opacity-55' : '', canDrag(i) ? 'cursor-grab active:cursor-grabbing' : '', drag?.id === i.id ? 'opacity-40' : '']"
            :draggable="canDrag(i)"
            @click="emit('open', i)"
            @dragstart="onDragStart(i, $event)"
            @dragend="drag = null; over = null"
          >
            <span class="h-[6px] w-[6px] shrink-0 rounded-full" :style="{ background: AGENDA_KIND_META[i.kind].color }" />
            <span v-if="!i.allDay" class="tabular shrink-0 text-[10px] font-semibold text-muted">{{ hhmm(i.at) }}</span>
            <span class="min-w-0 flex-1 truncate text-[11px] text-ink" :class="i.done ? 'line-through' : ''">{{ i.title }}</span>
          </button>

          <button
            v-if="c.items.length > SHOWN" type="button"
            class="focus-ring rounded px-1 text-left text-[10.5px] font-semibold text-plum hover:underline"
            @click="emit('pickDay', c.date)"
          >ещё {{ c.items.length - SHOWN }}</button>
        </div>
      </template>
    </div>
  </div>
</template>
