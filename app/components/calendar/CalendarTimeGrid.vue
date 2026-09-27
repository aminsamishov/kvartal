<script setup lang="ts">
import type { AgendaItem } from '~/utils/agenda'
import { AGENDA_KIND_META, dayKey } from '~/utils/agenda'
import { placeEvents, type PlacedEvent } from '~/utils/planner'
import { money } from '~/utils/format'

/**
 * Сетка планнера: один день или неделя — это одна и та же раскладка с разным
 * числом колонок, поэтому компонент один. Дело занимает высоту по своей
 * длительности, наложившиеся встречи делят ширину — так видно не список дел, а
 * занятость: куда в дне ещё влезет показ.
 *
 * Дела без часа (платёж по графику, дата подписания, срок брони) живут в
 * полосе «весь день»: их формальное время поставило бы их в случайный час.
 */
const props = withDefaults(defineProps<{
  days: Date[]
  items: AgendaItem[]
  fromHour?: number
  toHour?: number
}>(), { fromHour: 8, toHour: 20 })

const emit = defineEmits<{
  open: [AgendaItem]
  done: [AgendaItem]
  /** клик по пустому получасу — планирование задачи прямо из сетки */
  slot: [Date]
  pickDay: [Date]
  /** перенос задачи мышью: планнер без переноса — это просто список */
  move: [{ item: AgendaItem; at: Date }]
}>()

const HOUR_H = 52

const hours = computed(() => Array.from({ length: props.toHour - props.fromHour }, (_, i) => props.fromHour + i))

const todayKey = dayKey(new Date())

const cols = computed(() => props.days.map((date) => {
  const key = dayKey(date)
  const dayItems = props.items.filter((i) => dayKey(i.at) === key)
  return {
    date, key,
    weekday: date.toLocaleDateString('ru-RU', { weekday: 'short' }),
    today: key === todayKey,
    weekend: [0, 6].includes(date.getDay()),
    allDay: dayItems.filter((i) => i.allDay),
    placed: placeEvents(dayItems.filter((i) => !i.allDay), props.fromHour, props.toHour),
    open: dayItems.filter((i) => !i.done).length,
  }
}))

const anyAllDay = computed(() => cols.value.some((c) => c.allDay.length))

/* ------------------------------ линия «сейчас» ---------------------------- */

const now = ref(new Date())
// минута — достаточная точность: линия должна не дёргаться, а показывать,
// сколько от дня уже прошло
useIntervalFn(() => { now.value = new Date() }, 60_000)

const nowHours = computed(() => now.value.getHours() + now.value.getMinutes() / 60)
const nowVisible = computed(() => nowHours.value >= props.fromHour && nowHours.value <= props.toHour)
const nowTop = computed(() => `${(nowHours.value - props.fromHour) * HOUR_H}px`)
const nowLabel = computed(() => now.value.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }))

/* -------------------------------- раскладка ------------------------------- */

function blockStyle(e: PlacedEvent) {
  const width = 100 / e.cols
  const color = AGENDA_KIND_META[e.item.kind].color
  return {
    top: `${(e.start - props.fromHour) * HOUR_H + 1}px`,
    height: `${Math.max(26, (e.end - e.start) * HOUR_H - 3)}px`,
    left: `calc(${e.col * width}% + 3px)`,
    width: `calc(${width}% - 6px)`,
    borderColor: `color-mix(in srgb, ${color} 42%, transparent)`,
    background: `color-mix(in srgb, ${color} 11%, var(--panel))`,
  }
}
function blockHeight(e: PlacedEvent) {
  return (e.end - e.start) * HOUR_H
}
function hhmm(iso: string) {
  return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

/* ------------------------------ перенос мышью ----------------------------- */

/**
 * Двигать можно только задачи: у них есть срок, который менеджер вправе
 * поменять. Платёж по графику и дата подписания — факты договора, их
 * перетаскиванием не переносят.
 */
const drag = ref<AgendaItem | null>(null)
const dropAt = ref<{ key: string; hours: number } | null>(null)

function canDrag(item: AgendaItem) {
  return !!item.taskId && !item.done
}
function onDragStart(item: AgendaItem, ev: DragEvent) {
  if (!canDrag(item)) return
  drag.value = item
  if (ev.dataTransfer) {
    ev.dataTransfer.effectAllowed = 'move'
    ev.dataTransfer.setData('text/plain', item.id)
  }
}
function onDragOver(key: string, ev: DragEvent) {
  if (!drag.value) return
  ev.preventDefault()
  const rect = (ev.currentTarget as HTMLElement).getBoundingClientRect()
  // шаг в четверть часа: попасть мышью в минуту невозможно, а 15 минут —
  // привычная сетка записи на показ
  const raw = (ev.clientY - rect.top) / HOUR_H + props.fromHour
  const snapped = Math.round(raw * 4) / 4
  dropAt.value = { key, hours: Math.min(props.toHour - 0.25, Math.max(props.fromHour, snapped)) }
}
function onDrop(date: Date, ev: DragEvent) {
  if (!drag.value || !dropAt.value) return
  ev.preventDefault()
  const at = new Date(date)
  const h = Math.floor(dropAt.value.hours)
  at.setHours(h, Math.round((dropAt.value.hours - h) * 60), 0, 0)
  emit('move', { item: drag.value, at })
  drag.value = null
  dropAt.value = null
}
function onDragEnd() {
  drag.value = null
  dropAt.value = null
}
function dropLabel(hours: number) {
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function onSlot(date: Date, hour: number, ev: MouseEvent) {
  const el = ev.currentTarget as HTMLElement
  const half = ev.offsetY / el.clientHeight >= 0.5 ? 30 : 0
  const d = new Date(date)
  d.setHours(hour, half, 0, 0)
  emit('slot', d)
}
</script>

<template>
  <div class="overflow-auto rounded-card border border-line bg-panel shadow-card" style="max-height: calc(100vh - 250px)">
    <div :class="days.length > 1 ? 'min-w-[720px]' : ''">
      <!-- шапка дней -->
      <div class="sticky top-0 z-30 flex h-11 border-b border-line bg-panel">
        <div class="w-[58px] shrink-0 border-r border-line" />
        <button
          v-for="c in cols" :key="c.key" type="button"
          class="focus-ring flex min-w-0 flex-1 items-center justify-center gap-1.5 border-r border-line px-2 transition-colors last:border-r-0 hover:bg-soft"
          :class="c.weekend ? 'bg-soft/40' : ''"
          @click="emit('pickDay', c.date)"
        >
          <span class="text-[11px] uppercase tracking-[0.03em]" :class="c.today ? 'text-plum' : 'text-muted'">{{ c.weekday }}</span>
          <span
            class="tabular grid h-[22px] min-w-[22px] place-items-center rounded-full px-1 text-[13px] font-semibold"
            :class="c.today ? 'bg-fill-plum text-white' : 'text-ink'"
          >{{ c.date.getDate() }}</span>
          <span v-if="c.open" class="tabular hidden text-[11px] text-muted sm:inline">· {{ c.open }}</span>
        </button>
      </div>

      <!-- дела без часа -->
      <div v-if="anyAllDay" class="sticky top-11 z-20 flex border-b border-line bg-panel">
        <div class="w-[58px] shrink-0 border-r border-line py-1.5 pr-2 text-right text-[9.5px] uppercase leading-tight tracking-[0.03em] text-muted">
          весь<br>день
        </div>
        <div
          v-for="c in cols" :key="c.key"
          class="flex min-w-0 flex-1 flex-col gap-1 border-r border-line p-1 last:border-r-0"
          :class="c.weekend ? 'bg-soft/40' : ''"
        >
          <button
            v-for="i in c.allDay" :key="i.id" type="button"
            class="focus-ring flex items-center gap-1.5 rounded-md border-l-2 px-1.5 py-1 text-left transition-colors hover:bg-soft"
            :class="i.done ? 'opacity-55' : ''"
            :style="{
              borderColor: AGENDA_KIND_META[i.kind].color,
              background: `color-mix(in srgb, ${AGENDA_KIND_META[i.kind].color} 9%, var(--panel))`,
            }"
            @click="emit('open', i)"
          >
            <Icon :name="i.icon" size="12" class="shrink-0" :style="{ color: AGENDA_KIND_META[i.kind].color }" />
            <span class="min-w-0 flex-1 truncate text-[11.5px] font-medium text-ink">{{ i.title }}</span>
            <span v-if="i.overdue && !i.done" class="shrink-0 rounded-full bg-bad-bg px-1 text-[9.5px] font-bold text-bad">просроч.</span>
          </button>
        </div>
      </div>

      <!-- часы -->
      <div class="flex">
        <div class="w-[58px] shrink-0 border-r border-line">
          <div
            v-for="h in hours" :key="h"
            class="tabular border-b border-line/60 pr-2 pt-1 text-right text-[10.5px] text-muted last:border-b-0"
            :style="{ height: `${HOUR_H}px` }"
          >{{ String(h).padStart(2, '0') }}:00</div>
        </div>

        <div
          v-for="c in cols" :key="c.key"
          class="relative min-w-0 flex-1 border-r border-line last:border-r-0"
          :class="c.weekend ? 'bg-soft/35' : ''"
          @dragover="onDragOver(c.key, $event)"
          @drop="onDrop(c.date, $event)"
        >
          <!-- пустые получасы кликабельны: здесь и ставят следующую встречу -->
          <div
            v-for="h in hours" :key="h"
            class="group/slot cursor-pointer border-b border-line/60 transition-colors last:border-b-0 hover:bg-plum-soft/50"
            :style="{ height: `${HOUR_H}px` }"
            :title="`Запланировать на ${String(h).padStart(2, '0')}:00`"
            @click="onSlot(c.date, h, $event)"
          />

          <div class="pointer-events-none absolute inset-0">
            <button
              v-for="e in c.placed" :key="e.item.id" type="button"
              class="group pointer-events-auto absolute flex flex-col overflow-hidden rounded-md border border-l-[3px] px-1.5 py-[3px] text-left transition-shadow hover:shadow-rise"
              :class="[e.item.done ? 'opacity-60' : '', canDrag(e.item) ? 'cursor-grab active:cursor-grabbing' : '', drag?.id === e.item.id ? 'opacity-40' : '']"
              :style="blockStyle(e)"
              :draggable="canDrag(e.item)"
              @click="emit('open', e.item)"
              @dragstart="onDragStart(e.item, $event)"
              @dragend="onDragEnd"
            >
              <span class="flex min-w-0 items-center gap-1">
                <Icon :name="e.item.icon" size="11" class="shrink-0" :style="{ color: AGENDA_KIND_META[e.item.kind].color }" />
                <span class="tabular shrink-0 text-[10.5px] font-semibold text-muted">{{ hhmm(e.item.at) }}</span>
                <span
                  class="min-w-0 flex-1 truncate text-[11.5px] font-medium text-ink"
                  :class="e.item.done ? 'line-through' : ''"
                >{{ e.item.title }}</span>
              </span>
              <span
                v-if="blockHeight(e) >= 40 && e.item.subtitle"
                class="mt-0.5 truncate text-[10.5px] text-muted"
              >{{ e.item.subtitle }}</span>
              <span v-if="e.item.amount && blockHeight(e) >= 56" class="tabular mt-auto text-[10.5px] font-semibold text-ink">
                {{ money(e.item.amount) }}
              </span>

              <span
                v-if="e.item.overdue && !e.item.done"
                class="absolute right-1 top-1 rounded-full bg-bad-bg px-1 text-[9.5px] font-bold text-bad"
              >!</span>
              <span
                v-else-if="e.item.taskId && !e.item.done"
                class="focus-ring absolute bottom-0.5 right-0.5 grid h-5 w-5 place-items-center rounded bg-panel/80 text-muted opacity-0 transition-opacity hover:text-ok group-hover:opacity-100"
                title="Отметить выполненной"
                @click.stop="emit('done', e.item)"
              ><Icon name="ph:check" size="12" /></span>
            </button>
          </div>

          <!-- куда встанет задача, если отпустить -->
          <div
            v-if="drag && dropAt?.key === c.key"
            class="pointer-events-none absolute inset-x-0 z-20 flex items-center"
            :style="{ top: `${(dropAt.hours - fromHour) * HOUR_H}px` }"
          >
            <span class="tabular rounded-r bg-ink px-1 text-[9.5px] font-bold text-panel">{{ dropLabel(dropAt.hours) }}</span>
            <span class="h-[2px] flex-1 rounded-full bg-ink" />
          </div>

          <!-- где сейчас находится день -->
          <div
            v-if="c.today && nowVisible"
            class="pointer-events-none absolute inset-x-0 z-10 flex items-center"
            :style="{ top: nowTop }"
          >
            <span class="-ml-[3px] h-[7px] w-[7px] shrink-0 rounded-full bg-fill-bad" />
            <span class="h-px flex-1 bg-fill-bad/80" />
            <span class="tabular rounded-l bg-fill-bad px-1 text-[9.5px] font-bold text-white">{{ nowLabel }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
