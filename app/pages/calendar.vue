<script setup lang="ts">
import type { AgendaItem, AgendaKind } from '~/utils/agenda'
import { AGENDA_KIND_META, addDays, startOfDay, startOfWeek } from '~/utils/agenda'
import { fmtDateFull, money } from '~/utils/format'

definePageMeta({ breadcrumb: [{ label: 'Продажи' }, { label: 'Календарь' }] })

/**
 * Календарь продаж. Показы, встречи, подписания, платежи и задачи — это не
 * пять разных списков, а один день менеджера, поэтому лента собирается тем же
 * сборщиком, что и дашборд: «сегодня» там — этот же день здесь.
 */
const salesStore = useSalesStore()
const settingsStore = useSettingsStore()
const auth = useAuthStore()
const ui = useUiStore()
const { seesEveryone } = useAccess()

const mode = ref<'day' | 'week'>('day')
const cursor = ref(startOfDay(new Date()))

const from = computed(() => (mode.value === 'day' ? startOfDay(cursor.value) : startOfWeek(cursor.value)))
const to = computed(() => addDays(from.value, mode.value === 'day' ? 1 : 7))

const { items: scoped } = useAgenda(from, to)

/* -------------------------------- фильтры --------------------------------- */

const KINDS: { value: AgendaKind | 'all'; label: string }[] = [
  { value: 'all', label: 'Всё' },
  { value: 'visit', label: 'Показы' },
  { value: 'meeting', label: 'Встречи' },
  { value: 'contract', label: 'Договоры' },
  { value: 'payment', label: 'Платежи' },
  { value: 'call', label: 'Звонки' },
  { value: 'task', label: 'Задачи' },
]
const kind = ref<AgendaKind | 'all'>('all')
const managerId = ref('')

const managers = computed(() => settingsStore.users.filter((u) => u.active && ['manager', 'agent', 'care_manager'].includes(u.role)))

const items = computed(() => scoped.value
  .filter((i) => kind.value === 'all' || i.kind === kind.value)
  .filter((i) => !managerId.value || i.assignedTo === managerId.value))

const counts = computed(() => {
  const map = new Map<AgendaKind, number>()
  for (const i of scoped.value) map.set(i.kind, (map.get(i.kind) ?? 0) + 1)
  return map
})

/** Итоги периода: сколько показов, сколько денег по графику. */
const summary = computed(() => ({
  visits: scoped.value.filter((i) => i.kind === 'visit').length,
  meetings: scoped.value.filter((i) => i.kind === 'meeting').length,
  contracts: scoped.value.filter((i) => i.kind === 'contract').length,
  payments: scoped.value.filter((i) => i.kind === 'payment').reduce((s, i) => s + (i.amount ?? 0), 0),
  open: scoped.value.filter((i) => !i.done).length,
}))

/* ------------------------------- навигация -------------------------------- */

function shift(step: number) {
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
  const end = addDays(from.value, 6)
  const fmt = (d: Date) => d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
  return `${fmt(from.value)} — ${fmt(end)}`
})

/* -------------------------------- действия -------------------------------- */

function openItem(item: AgendaItem) {
  if (item.to) navigateTo(item.to)
}
function completeTask(item: AgendaItem) {
  if (!item.leadId || !item.taskId) return
  salesStore.completeLeadTask(item.leadId, item.taskId, '', auth.user?.name ?? 'Менеджер')
  ui.toast('Задача закрыта', 'ok')
}

/** Стрелки листают период, «т» возвращает на сегодня. */
useEventListener(window, 'keydown', (e: KeyboardEvent) => {
  const el = e.target as HTMLElement | null
  if (el && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return
  if (e.key === 'ArrowLeft') { shift(-1); e.preventDefault() }
  if (e.key === 'ArrowRight') { shift(1); e.preventDefault() }
  if (e.key.toLowerCase() === 'т' || e.key.toLowerCase() === 't') goToday()
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
        <AppButton variant="primary" icon="ph:magic-wand" @click="navigateTo('/deals/new')">Новая сделка</AppButton>
      </template>
    </PageHeader>

    <!-- период и режим -->
    <div class="flex flex-wrap items-center gap-2">
      <div class="flex items-center gap-1 rounded-xl2 border border-line bg-panel p-1">
        <button class="focus-ring grid h-7 w-7 place-items-center rounded-lg text-muted hover:text-ink" title="Назад (←)" @click="shift(-1)">
          <Icon name="ph:caret-left" size="15" />
        </button>
        <button class="focus-ring rounded-lg px-2 py-1 text-[12.5px] font-semibold text-ink hover:bg-soft" title="Сегодня (T)" @click="goToday">
          Сегодня
        </button>
        <button class="focus-ring grid h-7 w-7 place-items-center rounded-lg text-muted hover:text-ink" title="Вперёд (→)" @click="shift(1)">
          <Icon name="ph:caret-right" size="15" />
        </button>
      </div>

      <p class="text-[14px] font-semibold text-ink">{{ periodLabel }}</p>

      <SegmentedControl
        v-model="mode" class="ml-auto"
        :options="[{ value: 'day', label: 'День', icon: 'ph:calendar-blank' }, { value: 'week', label: 'Неделя', icon: 'ph:calendar-dots' }]"
      />
      <AppSelect
        v-if="seesEveryone" v-model="managerId" class="w-[190px]"
        :options="[{ value: '', label: 'Все менеджеры' }, ...managers.map((m) => ({ value: m.id, label: m.name }))]"
      />
    </div>

    <!-- итоги периода -->
    <section class="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line sm:grid-cols-5">
      <div v-for="s in [
        { label: 'Открытых дел', value: String(summary.open) },
        { label: 'Показы', value: String(summary.visits) },
        { label: 'Встречи', value: String(summary.meetings) },
        { label: 'Подписания', value: String(summary.contracts) },
        { label: 'Платежи', value: money(summary.payments) },
      ]" :key="s.label" class="bg-panel px-4 py-2.5"
      >
        <p class="text-[10.5px] uppercase tracking-[0.04em] text-muted">{{ s.label }}</p>
        <p class="tabular mt-0.5 text-[17px] font-semibold tracking-[-0.02em] text-ink">{{ s.value }}</p>
      </div>
    </section>

    <!-- фильтр по типу -->
    <div class="flex flex-wrap gap-1.5">
      <Chip
        v-for="k in KINDS" :key="k.value" :pressed="kind === k.value"
        :icon="k.value === 'all' ? 'ph:list-bullets' : AGENDA_KIND_META[k.value as AgendaKind].icon"
        @click="kind = k.value"
      >
        {{ k.label }}
        <span v-if="k.value !== 'all' && counts.get(k.value as AgendaKind)" class="tabular ml-1 text-muted">
          {{ counts.get(k.value as AgendaKind) }}
        </span>
      </Chip>
    </div>

    <CalendarDay v-if="mode === 'day'" :items="items" :date="cursor" @open="openItem" @done="completeTask" />
    <CalendarWeek v-else :items="items" :from="from" @open="openItem" @pick-day="pickDay" />

    <p class="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-muted">
      <span v-for="(meta, k) in AGENDA_KIND_META" :key="k" class="flex items-center gap-1.5">
        <span class="h-2 w-2 rounded-full" :style="{ background: meta.color }" /> {{ meta.label }}
      </span>
    </p>
  </div>
</template>
