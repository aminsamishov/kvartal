<script setup lang="ts">
import type { AgendaItem, AgendaKind } from '~/utils/agenda'
import { addDays, startOfDay } from '~/utils/agenda'
import { nextWorkSlot } from '~/utils/planner'
import type { MetricItem } from '~/components/dashboard/MetricStrip.vue'
import { fmtDateFull, money, moneyCompact, pluralRu } from '~/utils/format'

definePageMeta({ breadcrumb: [{ label: 'Дашборд' }] })

/**
 * Операционный центр. Дашборд отвечает на вопрос «что делать сейчас», а не
 * «как шли дела в мае»: сверху показатели дня, под ними ближайшее дело и лента
 * с осью времени, справа то, что горит. Графики компании живут ниже и только у
 * того, кому видны её деньги — менеджеру они мешают увидеть свой день.
 *
 * Клик по делу открывает то, о чём дело: карточку заявки, договор, помещение.
 * Раньше любая строка вела на список заявок, и нужную искали там руками.
 */
const { can, workspace, seesEveryone, myId } = useAccess()
const salesStore = useSalesStore()
const dealsStore = useDealsStore()
const unitsStore = useUnitsStore()
const approvalsStore = useApprovalsStore()
const auth = useAuthStore()
const ui = useUiStore()

const now = new Date()
const from = computed(() => startOfDay(now))
const to = computed(() => addDays(from.value, 1))
const { items: today } = useAgenda(from, to)

// неделя вперёд — для полосы ближайших дней внизу
const weekTo = computed(() => addDays(from.value, 7))
const { items: week } = useAgenda(from, weekTo)

/* ------------------------------ лента и фильтр ---------------------------- */

const filter = ref<'all' | AgendaKind>('all')
const FILTERS: { value: 'all' | AgendaKind; label: string; icon: string }[] = [
  { value: 'all', label: 'Всё', icon: 'ph:list-bullets' },
  { value: 'visit', label: 'Показы', icon: 'ph:buildings' },
  { value: 'call', label: 'Звонки', icon: 'ph:phone' },
  { value: 'meeting', label: 'Встречи', icon: 'ph:users-three' },
  { value: 'payment', label: 'Платежи', icon: 'ph:hand-coins' },
]
const feed = computed(() => (filter.value === 'all' ? today.value : today.value.filter((i) => i.kind === filter.value)))
const kindCount = (k: AgendaKind) => today.value.filter((i) => i.kind === k).length

const visitsToday = computed(() => today.value.filter((i) => i.kind === 'visit'))
const paymentsToday = computed(() => today.value.filter((i) => i.kind === 'payment'))
const doneToday = computed(() => today.value.filter((i) => i.done).length)

/** Ближайшее незакрытое дело — то, ради чего дашборд открывают утром. */
const nextItem = computed(() => today.value.find((i) => !i.done && new Date(i.at) >= now)
  ?? today.value.find((i) => !i.done)
  ?? null)

/* -------------------------------- просрочки ------------------------------- */

/** Просрочка — это и деньги, и задачи: на одном экране их и смотрят. */
const overdueTasks = computed(() => {
  const out: AgendaItem[] = []
  for (const lead of salesStore.leads) {
    if (!seesEveryone.value && lead.assignedTo !== myId.value) continue
    for (const t of lead.tasks) {
      if (t.done || new Date(t.dueAt) >= from.value) continue
      out.push({
        id: `od-${t.id}`, at: t.dueAt, kind: t.kind === 'other' ? 'task' : t.kind,
        title: t.title, subtitle: salesStore.client(lead.clientId)?.name ?? '',
        icon: 'ph:clock-countdown', tone: 'bad', assignedTo: t.assignedTo || lead.assignedTo,
        overdue: true, to: `/leads?lead=${lead.id}`, leadId: lead.id, taskId: t.id,
      })
    }
  }
  return out.sort((a, b) => a.at.localeCompare(b.at))
})

const overdueContracts = computed(() => dealsStore.contracts
  .filter((c) => c.status === 'active')
  .map((c) => ({ contract: c, balance: dealsStore.balance(c.id) }))
  .filter((x) => x.balance.overdueAmount > 0)
  .filter((x) => seesEveryone.value || (x.contract.leadId && salesStore.lead(x.contract.leadId)?.assignedTo === myId.value))
  .sort((a, b) => b.balance.overdueDays - a.balance.overdueDays))

const overdueAmount = computed(() => overdueContracts.value.reduce((s, x) => s + x.balance.overdueAmount, 0))

/* ------------------------------- брони и заявки --------------------------- */

const myLeads = computed(() => salesStore.leads
  .filter((l) => l.stage !== 'lost' && l.stage !== 'deal')
  .filter((l) => seesEveryone.value || l.assignedTo === myId.value))

const expiringReservations = computed(() => salesStore.activeReservations
  .filter((r) => seesEveryone.value || r.createdBy === myId.value || (r.leadId && salesStore.lead(r.leadId)?.assignedTo === myId.value))
  .map((r) => ({ r, days: Math.ceil((new Date(r.expiresAt).getTime() - now.getTime()) / 86400000) }))
  .filter((x) => x.days <= 3)
  .sort((a, b) => a.days - b.days))

const monthContracts = computed(() => dealsStore.contracts
  .filter((c) => c.signedAt && new Date(c.signedAt).getMonth() === now.getMonth() && new Date(c.signedAt).getFullYear() === now.getFullYear())
  .filter((c) => seesEveryone.value || (c.leadId && salesStore.lead(c.leadId)?.assignedTo === myId.value)))

const receiptsToday = computed(() => dealsStore.payments
  .filter((p) => p.status === 'confirmed' && new Date(p.date) >= from.value && new Date(p.date) < to.value)
  .reduce((s, p) => s + p.amount, 0))

/* ------------------------------ показатели дня ---------------------------- */

const kpis = computed<MetricItem[]>(() => {
  const openToday = today.value.filter((i) => !i.done).length
  const pct = today.value.length ? Math.round((doneToday.value / today.value.length) * 100) : 100
  const base: MetricItem[] = [
    {
      key: 'agenda', label: 'Дел на сегодня', value: String(openToday), unit: openToday ? 'открыто' : undefined,
      hero: true, tone: 'ok', meter: { pct, caption: `${doneToday.value} из ${today.value.length} закрыто` },
    },
    { key: 'visits', label: 'Показы сегодня', value: String(visitsToday.value.length), hint: visitsToday.value.length ? 'встречи на объекте' : 'не запланированы' },
    {
      key: 'overdue-task', label: 'Просроченные задачи', value: String(overdueTasks.value.length),
      valueTone: overdueTasks.value.length ? 'bad' : undefined, hint: 'ждут действия', to: '/leads',
    },
  ]

  if (workspace.value === 'finance') {
    return [
      base[0]!,
      { key: 'pay-today', label: 'Платежи сегодня', value: money(paymentsToday.value.reduce((s, i) => s + (i.amount ?? 0), 0)), hint: `${paymentsToday.value.length} по графику`, to: '/payments' },
      { key: 'received', label: 'Поступило сегодня', value: money(receiptsToday.value), valueTone: 'ok', to: '/payments' },
      { key: 'pending', label: 'На подтверждении', value: String(dealsStore.pendingPayments.length), valueTone: dealsStore.pendingPayments.length ? 'warn' : undefined, to: '/payments' },
      { key: 'overdue', label: 'Просрочка', value: moneyCompact(overdueAmount.value), valueTone: overdueAmount.value ? 'bad' : undefined, hint: `${overdueContracts.value.length} договоров`, to: '/contracts' },
      { key: 'contracts', label: 'Договоров за месяц', value: String(monthContracts.value.length), to: '/contracts' },
    ]
  }

  if (can('dashboard.company')) {
    const revenue = unitsStore.units.filter((u) => u.status === 'sold' || u.status === 'installment').reduce((s, u) => s + u.price, 0)
    return [
      ...base,
      { key: 'overdue', label: 'Просрочка', value: moneyCompact(overdueAmount.value), valueTone: overdueAmount.value ? 'bad' : undefined, hint: `${overdueContracts.value.length} договоров`, to: '/contracts' },
      { key: 'leads', label: 'Заявки в работе', value: String(myLeads.value.length), to: '/leads' },
      { key: 'revenue', label: 'Выручка в работе', value: moneyCompact(revenue), hint: `${monthContracts.value.length} сделок за месяц` },
    ]
  }

  // менеджер: его день, его заявки, его деньги
  return [
    ...base,
    {
      key: 'res', label: 'Брони на исходе', value: String(expiringReservations.value.length),
      valueTone: expiringReservations.value.length ? 'warn' : undefined, hint: 'ближайшие 3 дня', to: '/board',
    },
    { key: 'leads', label: 'Мои заявки', value: String(myLeads.value.length), hint: 'в работе', to: '/leads' },
    {
      key: 'deals', label: 'Мои сделки за месяц', value: String(monthContracts.value.length),
      hint: monthContracts.value.length ? moneyCompact(monthContracts.value.reduce((s, c) => s + c.price, 0)) : 'пока нет', to: '/contracts',
    },
  ]
})

/* ----------------------------- требует внимания ---------------------------- */

const attention = computed(() => [
  { key: 'approval', label: 'Скидки на согласовании', count: can('approvals.view') ? approvalsStore.pending.length : 0, tone: 'warn' as const, icon: 'ph:percent', to: '/approvals' },
  { key: 'pay', label: 'Платежи на подтверждении', count: can('payments.confirm') ? dealsStore.pendingPayments.length : 0, tone: 'warn' as const, icon: 'ph:hand-coins', to: '/payments' },
  { key: 'res', label: 'Брони истекают', count: expiringReservations.value.length, tone: 'warn' as const, icon: 'ph:hourglass', to: '/board' },
  { key: 'lead', label: 'Заявки без следующего шага', count: myLeads.value.filter((l) => salesStore.taskState(l) === 'none').length, tone: 'info' as const, icon: 'ph:chat-dots', to: '/leads' },
].filter((r) => r.count > 0))

/* --------------------------------- действия -------------------------------- */

const { leadId, unitId, open: openItem, close: closeItem } = useAgendaOpen()
const lostFor = ref<string | null>(null)

function completeTask(item: AgendaItem) {
  if (!item.leadId || !item.taskId) return
  salesStore.completeLeadTask(item.leadId, item.taskId, '', auth.user?.name ?? 'Менеджер')
  ui.toast('Задача закрыта', 'ok')
}

const planOpen = ref(false)
const planFor = ref<string | undefined>()
function planNow() {
  planFor.value = nextWorkSlot().toISOString()
  planOpen.value = true
}

function openDay(date: Date) {
  navigateTo(`/calendar?date=${date.toISOString().slice(0, 10)}`)
}

const greeting = computed(() => {
  const h = now.getHours()
  const name = auth.user?.name.split(' ')[1] ?? auth.user?.name ?? ''
  return `${h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер'}${name ? `, ${name}` : ''}`
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <PageHeader :title="greeting" :subtitle="`${fmtDateFull(now.toISOString())} · ${today.length} ${pluralRu(today.length, 'событие', 'события', 'событий')} в плане`">
      <template #actions>
        <AppButton v-if="can('calendar.view')" icon="ph:calendar-dots" @click="navigateTo('/calendar')">Календарь</AppButton>
        <AppButton v-if="can('board.view')" icon="ph:grid-nine" @click="navigateTo('/board')">Шахматка</AppButton>
        <AppButton v-if="can('deals.create')" variant="primary" icon="ph:magic-wand" @click="navigateTo('/deals/new')">Новая сделка</AppButton>
      </template>
    </PageHeader>

    <MetricStrip :items="kpis" />

    <div class="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <div class="flex min-w-0 flex-col gap-4">
        <NextAction
          :item="nextItem" :done-count="doneToday" :total="today.length"
          @open="openItem" @complete="completeTask" @plan="planNow"
        />

        <!-- лента дня -->
        <AppCard :padded="false">
          <div class="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
            <div>
              <h3 class="text-[14px] font-semibold tracking-[-0.01em] text-ink">План на сегодня</h3>
              <p class="text-[12px] text-muted">
                {{ seesEveryone ? 'Отдел продаж' : 'Ваши дела' }} · клик открывает карточку
              </p>
            </div>
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="f in FILTERS" :key="f.value" type="button"
                class="focus-ring inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors"
                :class="filter === f.value ? 'border-ink bg-ink text-panel' : 'border-line bg-panel text-muted hover:text-ink'"
                @click="filter = f.value"
              >
                <Icon :name="f.icon" size="12" />{{ f.label }}
                <span v-if="f.value !== 'all' && kindCount(f.value as AgendaKind)" class="tabular opacity-70">
                  {{ kindCount(f.value as AgendaKind) }}
                </span>
              </button>
            </div>
          </div>
          <div class="px-4 py-3">
            <AgendaTimeline
              :items="feed"
              empty-title="На сегодня дел нет"
              empty-text="Поставьте задачу в карточке заявки — она появится здесь"
              @done="completeTask" @open="openItem"
            />
          </div>
        </AppCard>
      </div>

      <div class="flex min-w-0 flex-col gap-4">
        <!-- требует внимания -->
        <AppCard v-if="attention.length" title="Требует внимания" subtitle="Система ждёт решения">
          <div class="-mx-1.5 flex flex-col">
            <NuxtLink
              v-for="a in attention" :key="a.key" :to="a.to"
              class="flex items-center gap-3 rounded-xl2 px-1.5 py-2 transition-colors hover:bg-soft"
            >
              <span
                class="grid h-8 w-8 shrink-0 place-items-center rounded-xl2"
                :class="{ warn: 'bg-warn-bg text-warn', bad: 'bg-bad-bg text-bad', info: 'bg-info-bg text-info' }[a.tone]"
              ><Icon :name="a.icon" size="16" /></span>
              <span class="min-w-0 flex-1 text-[13px] text-ink">{{ a.label }}</span>
              <span class="tabular text-[15px] font-semibold text-ink">{{ a.count }}</span>
              <Icon name="ph:caret-right" size="13" class="shrink-0 text-muted" />
            </NuxtLink>
          </div>
        </AppCard>

        <!-- просрочки -->
        <AppCard
          title="Просрочки"
          :subtitle="overdueAmount || overdueTasks.length ? `${moneyCompact(overdueAmount)} по графику · ${overdueTasks.length} ${pluralRu(overdueTasks.length, 'задача', 'задачи', 'задач')}` : 'Всё в сроке'"
        >
          <div v-if="overdueContracts.length" class="mb-2 flex flex-col gap-1">
            <NuxtLink
              v-for="x in overdueContracts.slice(0, 4)" :key="x.contract.id" :to="`/contracts/${x.contract.id}`"
              class="flex items-center gap-2 rounded-lg bg-bad-bg/60 px-2 py-1.5 text-[12px] transition-colors hover:bg-bad-bg"
            >
              <Icon name="ph:warning-circle" size="14" class="shrink-0 text-bad" />
              <span class="min-w-0 flex-1 truncate text-ink">{{ salesStore.client(x.contract.clientId)?.name ?? x.contract.number }}</span>
              <span class="tabular shrink-0 font-semibold text-bad">{{ moneyCompact(x.balance.overdueAmount) }}</span>
              <span class="tabular shrink-0 text-[11px] text-muted">{{ x.balance.overdueDays }} дн.</span>
            </NuxtLink>
          </div>
          <AgendaList
            :items="overdueTasks" :limit="4" compact
            empty-icon="ph:check-circle" empty-title="Просроченных задач нет"
            @done="completeTask" @open="openItem"
          />
        </AppCard>

        <!-- платежи сегодня -->
        <AppCard
          v-if="can('payments.view')"
          title="Платежи сегодня"
          :subtitle="paymentsToday.length ? `${money(paymentsToday.reduce((s, i) => s + (i.amount ?? 0), 0))} по графику` : 'На сегодня платежей нет'"
        >
          <template #actions>
            <NuxtLink to="/payments" class="text-[12.5px] font-semibold text-plum hover:underline">Доска оплат</NuxtLink>
          </template>
          <AgendaList :items="paymentsToday" :limit="5" empty-icon="ph:hand-coins" empty-title="Платежей на сегодня нет" @open="openItem" />
        </AppCard>

        <!-- показы сегодня -->
        <AppCard title="Показы сегодня" :subtitle="visitsToday.length ? `${visitsToday.length} ${pluralRu(visitsToday.length, 'встреча', 'встречи', 'встреч')} на объекте` : 'Показов не запланировано'">
          <AgendaList
            :items="visitsToday" empty-icon="ph:buildings" empty-title="Показов сегодня нет"
            empty-text="Запланируйте показ в карточке заявки"
            @done="completeTask" @open="openItem"
          />
        </AppCard>
      </div>
    </div>

    <!-- ближайшая неделя -->
    <template v-if="can('calendar.view')">
      <SectionHeader title="Ближайшая неделя" subtitle="Плотность дней — куда ещё влезет показ" />
      <WeekAhead :items="week" :from="from" @pick="openDay" />
    </template>

    <!-- аналитика компании: только тем, кому видны её деньги -->
    <template v-if="can('dashboard.company')">
      <SectionHeader title="Аналитика компании" subtitle="Деньги, воронка и фонд за 12 месяцев" />
      <CompanyAnalytics />
    </template>

    <LeadDrawer :lead-id="leadId" @close="closeItem" @request-lost="lostFor = $event" @navigate="leadId = $event" />
    <UnitDrawer :unit-id="unitId" @close="closeItem" @navigate="unitId = $event" />
    <LeadLostModal :lead-id="lostFor" @close="lostFor = null" />
    <AgendaPlanDrawer v-model="planOpen" :due="planFor" />
  </div>
</template>
