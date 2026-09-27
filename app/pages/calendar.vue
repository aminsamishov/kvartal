<script setup lang="ts">
import type { AgendaItem, AgendaKind } from '~/utils/agenda'
import { AGENDA_KIND_META, addDays, dayKey, startOfDay, startOfWeek } from '~/utils/agenda'
import { nextWorkSlot, workWindow } from '~/utils/planner'
import { fmtDateFull, fmtMonthYear, money } from '~/utils/format'

definePageMeta({ breadcrumb: [{ label: 'Продажи' }, { label: 'Календарь' }] })

/**
 * Планнер продаж. Показы, встречи, подписания, платежи и задачи — это не пять
 * списков, а один день менеджера, поэтому лента собирается тем же сборщиком,
 * что и дашборд: «сегодня» там — этот же день здесь.
 *
 * Три масштаба вместо двух: день — работа по часам, неделя — та же сетка на
 * семь колонок, месяц — карта загрузки. Клик по делу открывает то, о чём оно:
 * задача и показ — карточку заявки, платёж — договор, бронь — помещение.
 */
const salesStore = useSalesStore()
const settingsStore = useSettingsStore()
const auth = useAuthStore()
const ui = useUiStore()
const { seesEveryone } = useAccess()

type Mode = 'day' | 'week' | 'month'
const mode = ref<Mode>('day')

/** ?date=YYYY-MM-DD — так в планнер приходят с дашборда и из писем. */
const route = useRoute()
const fromQuery = new Date(String(route.query.date ?? ''))
const cursor = ref(startOfDay(Number.isNaN(fromQuery.getTime()) ? new Date() : fromQuery))

/** Начало месяца — опора и для сетки месяца, и для навигатора в колонке. */
const monthStart = computed(() => new Date(cursor.value.getFullYear(), cursor.value.getMonth(), 1))

const from = computed(() => {
  if (mode.value === 'day') return startOfDay(cursor.value)
  if (mode.value === 'week') return startOfWeek(cursor.value)
  return startOfWeek(monthStart.value)
})
const to = computed(() => addDays(from.value, mode.value === 'day' ? 1 : mode.value === 'week' ? 7 : 42))

const { items: scoped } = useAgenda(from, to)

/* ------------------------------- навигатор -------------------------------- */

// у мини-месяца свой курсор: можно листать вперёд, не сдвигая рабочий день.
// Повестку под него собираем отдельно — иначе точки нагрузки будут только у
// текущего периода
const railMonth = ref(new Date(cursor.value.getFullYear(), cursor.value.getMonth(), 1))
watch(cursor, (d) => { railMonth.value = new Date(d.getFullYear(), d.getMonth(), 1) })
const railFrom = computed(() => startOfWeek(railMonth.value))
const railTo = computed(() => addDays(railFrom.value, 42))
const { items: railItems } = useAgenda(railFrom, railTo)

/* -------------------------------- фильтры --------------------------------- */

const KINDS = Object.keys(AGENDA_KIND_META) as AgendaKind[]
const hidden = ref(new Set<AgendaKind>())
const hideDone = ref(false)
const managerId = ref('')

function toggleKind(k: AgendaKind) {
  const next = new Set(hidden.value)
  if (next.has(k)) next.delete(k)
  else next.add(k)
  hidden.value = next
}
function showAllKinds() {
  hidden.value = new Set()
}

const managers = computed(() => settingsStore.users.filter((u) => u.active && ['manager', 'agent', 'care_manager'].includes(u.role)))

const items = computed(() => scoped.value
  .filter((i) => !hidden.value.has(i.kind))
  .filter((i) => !hideDone.value || !i.done)
  .filter((i) => !managerId.value || i.assignedTo === managerId.value))

const counts = computed(() => {
  const map = new Map<AgendaKind, number>()
  for (const i of scoped.value) map.set(i.kind, (map.get(i.kind) ?? 0) + 1)
  return map
})

/** Рабочее окно сетки: если показ назначен на 7:30, день начинается с семи. */
const win = computed(() => workWindow(items.value))

const days = computed(() => (mode.value === 'day'
  ? [cursor.value]
  : Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(cursor.value), i))))

/** Итоги периода: сколько показов, сколько денег по графику. */
const summary = computed(() => ({
  open: items.value.filter((i) => !i.done).length,
  visits: items.value.filter((i) => i.kind === 'visit').length,
  meetings: items.value.filter((i) => i.kind === 'meeting' || i.kind === 'call').length,
  contracts: items.value.filter((i) => i.kind === 'contract').length,
  payments: items.value.filter((i) => i.kind === 'payment').reduce((s, i) => s + (i.amount ?? 0), 0),
  overdue: items.value.filter((i) => i.overdue && !i.done).length,
}))

/* ------------------------------- навигация -------------------------------- */

function shift(step: number) {
  if (mode.value === 'month') {
    cursor.value = new Date(cursor.value.getFullYear(), cursor.value.getMonth() + step, 1)
    return
  }
  cursor.value = addDays(cursor.value, mode.value === 'day' ? step : step * 7)
}
function goToday() {
  cursor.value = startOfDay(new Date())
}
function pickDay(date: Date) {
  cursor.value = startOfDay(date)
  mode.value = 'day'
}

const periodLabel = computed(() => {
  if (mode.value === 'day') return fmtDateFull(cursor.value.toISOString())
  if (mode.value === 'month') return fmtMonthYear(cursor.value)
  const start = startOfWeek(cursor.value)
  const end = addDays(start, 6)
  const fmt = (d: Date) => d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
  return `${fmt(start)} — ${fmt(end)}`
})

const isToday = computed(() => dayKey(cursor.value) === dayKey(new Date()))

/* -------------------------------- действия -------------------------------- */

// клик по делу открывает то, о чём дело: карточку заявки, договор, помещение
const { leadId, unitId, open: openItem, close: closeItem } = useAgendaOpen()
const lostFor = ref<string | null>(null)

/** Перенос задачи из сетки: тот же срок, что правят в карточке заявки. */
function moveTask({ item, at }: { item: AgendaItem; at: Date }) {
  if (!item.leadId || !item.taskId) return
  salesStore.updateLeadTask(item.leadId, item.taskId, { dueAt: at.toISOString() }, auth.user?.name ?? 'Менеджер')
  ui.toast(`Перенесено на ${at.toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}`, 'ok')
}

function completeTask(item: AgendaItem) {
  if (!item.leadId || !item.taskId) return
  salesStore.completeLeadTask(item.leadId, item.taskId, '', auth.user?.name ?? 'Менеджер')
  ui.toast('Задача закрыта', 'ok')
}

// планирование прямо из сетки: клик по пустому часу — это и есть «поставить
// встречу на 15:30», а не «открыть форму и ввести дату руками»
const planFor = ref<string | undefined>()
const planOpen = ref(false)
function planAt(date: Date) {
  // из сетки месяца приходит полночь: час там не выбирают, ставим начало дня
  const at = new Date(date)
  if (!at.getHours() && !at.getMinutes()) at.setHours(10, 0, 0, 0)
  planFor.value = at.toISOString()
  planOpen.value = true
}
function planNow() {
  // на сегодня — ближайший рабочий час, на другой день — начало рабочего дня
  if (isToday.value) { planAt(nextWorkSlot()); return }
  const d = new Date(cursor.value)
  d.setHours(10, 0, 0, 0)
  planAt(d)
}

/** Стрелки листают период, «т» возвращает на сегодня, 1/2/3 — масштаб. */
useEventListener(window, 'keydown', (e: KeyboardEvent) => {
  const el = e.target as HTMLElement | null
  if (el && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return
  if (e.metaKey || e.ctrlKey || e.altKey) return
  if (e.key === 'ArrowLeft') { shift(-1); e.preventDefault() }
  if (e.key === 'ArrowRight') { shift(1); e.preventDefault() }
  if (e.key.toLowerCase() === 'т' || e.key.toLowerCase() === 't') goToday()
  if (e.key === '1') mode.value = 'day'
  if (e.key === '2') mode.value = 'week'
  if (e.key === '3') mode.value = 'month'
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <PageHeader
      title="Календарь продаж"
      :subtitle="seesEveryone ? 'Показы, встречи, подписания и платежи отдела' : 'Ваши показы, встречи, подписания и платежи'"
    >
      <template #actions>
        <AppButton icon="ph:funnel" @click="navigateTo('/leads')">Заявки</AppButton>
        <AppButton variant="primary" icon="ph:plus-bold" @click="planNow">Запланировать</AppButton>
      </template>
    </PageHeader>

    <!-- период и масштаб -->
    <div class="flex flex-wrap items-center gap-2">
      <div class="flex items-center gap-0.5 rounded-xl2 border border-line bg-panel p-1 shadow-card">
        <button class="focus-ring grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-soft hover:text-ink" title="Назад (←)" @click="shift(-1)">
          <Icon name="ph:caret-left" size="15" />
        </button>
        <button
          class="focus-ring rounded-lg px-2.5 py-1 text-[12.5px] font-semibold transition-colors"
          :class="isToday && mode === 'day' ? 'text-muted' : 'text-ink hover:bg-soft'"
          title="Сегодня (T)" @click="goToday"
        >Сегодня</button>
        <button class="focus-ring grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-soft hover:text-ink" title="Вперёд (→)" @click="shift(1)">
          <Icon name="ph:caret-right" size="15" />
        </button>
      </div>

      <p class="text-[15px] font-semibold tracking-[-0.015em] text-ink">{{ periodLabel }}</p>
      <span v-if="summary.overdue" class="rounded-full bg-bad-bg px-2 py-0.5 text-[11.5px] font-semibold text-bad">
        просрочено {{ summary.overdue }}
      </span>

      <SegmentedControl
        :model-value="mode" class="ml-auto"
        :options="[
          { value: 'day', label: 'День', icon: 'ph:calendar-blank' },
          { value: 'week', label: 'Неделя', icon: 'ph:calendar-dots' },
          { value: 'month', label: 'Месяц', icon: 'ph:calendar' },
        ]"
        @update:model-value="mode = $event as Mode"
      />
      <AppSelect
        v-if="seesEveryone" v-model="managerId" class="w-[190px]"
        :options="[{ value: '', label: 'Все менеджеры' }, ...managers.map((m) => ({ value: m.id, label: m.name }))]"
      />
    </div>

    <div class="grid grid-cols-1 gap-4 xl:grid-cols-[236px_minmax(0,1fr)]">
      <!-- боковая колонка планнера -->
      <aside class="flex flex-col gap-3 max-xl:hidden">
        <CalendarMiniMonth
          :month="railMonth" :cursor="cursor" :items="railItems"
          @pick="pickDay" @update:month="railMonth = $event"
        />

        <section class="rounded-card border border-line bg-panel p-3 shadow-card">
          <header class="mb-2 flex items-center justify-between">
            <h3 class="text-[12px] font-semibold uppercase tracking-[0.04em] text-muted">Виды дел</h3>
            <button v-if="hidden.size" class="text-[11.5px] font-medium text-plum hover:underline" @click="showAllKinds">все</button>
          </header>
          <div class="-mx-1 flex flex-col">
            <button
              v-for="k in KINDS" :key="k" type="button"
              class="focus-ring flex items-center gap-2 rounded-lg px-1 py-1 text-left transition-colors hover:bg-soft"
              @click="toggleKind(k)"
            >
              <span
                class="grid h-[13px] w-[13px] shrink-0 place-items-center rounded-[4px] border transition-colors"
                :style="hidden.has(k)
                  ? { borderColor: 'var(--line)' }
                  : { borderColor: AGENDA_KIND_META[k].color, background: AGENDA_KIND_META[k].color }"
              >
                <!-- галочка цветом поверхности: на светлом фоне она белая, в
                     тёмной теме — тёмная, потому что цвета видов дел там светлее -->
                <Icon v-if="!hidden.has(k)" name="ph:check-bold" size="9" class="text-panel" />
              </span>
              <span class="min-w-0 flex-1 truncate text-[12.5px]" :class="hidden.has(k) ? 'text-muted' : 'text-ink'">
                {{ AGENDA_KIND_META[k].label }}
              </span>
              <span class="tabular text-[11.5px] text-muted">{{ counts.get(k) ?? 0 }}</span>
            </button>
          </div>
          <label class="mt-2 flex cursor-pointer items-center gap-2 border-t border-line pt-2 text-[12.5px] text-ink">
            <input v-model="hideDone" type="checkbox" class="accent-[var(--plum)]">
            Скрыть завершённые
          </label>
        </section>

        <section class="rounded-card border border-line bg-panel p-3 shadow-card">
          <h3 class="mb-2 text-[12px] font-semibold uppercase tracking-[0.04em] text-muted">Итоги периода</h3>
          <dl class="flex flex-col">
            <div
              v-for="s in [
                { label: 'Открытых дел', value: String(summary.open) },
                { label: 'Показы', value: String(summary.visits) },
                { label: 'Звонки и встречи', value: String(summary.meetings) },
                { label: 'Подписания', value: String(summary.contracts) },
                { label: 'Платежи', value: money(summary.payments) },
              ]" :key="s.label"
              class="flex items-baseline justify-between gap-2 border-b border-line py-1.5 last:border-0"
            >
              <dt class="text-[12px] text-muted">{{ s.label }}</dt>
              <dd class="tabular text-[13px] font-semibold text-ink">{{ s.value }}</dd>
            </div>
          </dl>
        </section>

        <p class="px-1 text-[11px] leading-relaxed text-muted">
          ← → листают период, <span class="font-semibold text-ink">T</span> — сегодня,
          <span class="font-semibold text-ink">1 2 3</span> — день, неделя, месяц.
          Клик по пустому часу ставит задачу, задачу можно перетащить на другое время.
        </p>
      </aside>

      <!-- сетка -->
      <CalendarMonth
        v-if="mode === 'month'" :month="monthStart" :items="items"
        @open="openItem" @pick-day="pickDay" @slot="planAt" @move="moveTask"
      />
      <CalendarTimeGrid
        v-else :days="days" :items="items" :from-hour="win.from" :to-hour="win.to"
        @open="openItem" @done="completeTask" @slot="planAt" @pick-day="pickDay" @move="moveTask"
      />
    </div>

    <LeadDrawer :lead-id="leadId" @close="closeItem" @request-lost="lostFor = $event" @navigate="leadId = $event" />
    <UnitDrawer :unit-id="unitId" @close="closeItem" @navigate="unitId = $event" />
    <LeadLostModal :lead-id="lostFor" @close="lostFor = null" />
    <AgendaPlanDrawer v-model="planOpen" :due="planFor" />
  </div>
</template>
