<script setup lang="ts">
import { TODAY } from '~/data/seed'
import { LEAD_PIPELINE, LEAD_STAGE_META, PAYMENT_BUCKET_META, UNIT_STATUS_META } from '~/utils/meta'
import { fmtDate, fmtDateFull, money, moneyCompact, projectBadge } from '~/utils/format'
import {
  avgDealCycleDays, avgPricePerM2, expiringReservations, lastMonths, leadSourceStats,
  momDelta, planFactSeries, reservationToContract, salesByManager, salesByProject, seriesBy, stageFunnel,
} from '~/utils/analytics'
import type { MetricItem } from '~/components/dashboard/MetricStrip.vue'
import type { UnitStatus } from '~/types/models'

definePageMeta({ breadcrumb: [{ label: 'Дашборд' }] })

const unitsStore = useUnitsStore()
const salesStore = useSalesStore()
const dealsStore = useDealsStore()
const settingsStore = useSettingsStore()
const approvalsStore = useApprovalsStore()
const miscStore = useMiscStore()

const months = computed(() => lastMonths(TODAY, 12))

/* ------------------------------- показатели ------------------------------- */

const revenueInWork = computed(() => unitsStore.units
  .filter((u) => u.status === 'sold' || u.status === 'installment')
  .reduce((s, u) => s + u.price, 0))

const receiptsSeries = computed(() => seriesBy(months.value, dealsStore.payments,
  (p) => (p.status === 'confirmed' ? p.date : undefined), (p) => p.amount))
const dealsSeries = computed(() => seriesBy(months.value, dealsStore.contracts, (c) => c.signedAt, () => 1))
const salesSeries = computed(() => seriesBy(months.value, dealsStore.contracts, (c) => c.signedAt, (c) => c.price))
const leadsSeries = computed(() => seriesBy(months.value, salesStore.leads, (l) => l.createdAt, () => 1))

const monthReceipts = computed(() => receiptsSeries.value[receiptsSeries.value.length - 1] ?? 0)
const receiptsDelta = computed(() => momDelta(receiptsSeries.value))
const salesDelta = computed(() => momDelta(salesSeries.value))
const leadsDelta = computed(() => momDelta(leadsSeries.value))

const debtSeries = computed(() => seriesBy(months.value, dealsStore.scheduleItems,
  (i) => (i.paid < i.amount && new Date(i.dueDate) <= TODAY ? i.dueDate : undefined), (i) => i.amount - i.paid))
const totalDebt = computed(() => dealsStore.contracts.reduce((s, c) => s + dealsStore.balance(c.id).overdueAmount, 0))
const overdueContracts = computed(() => dealsStore.contracts.filter((c) => dealsStore.balance(c.id).overdueAmount > 0))
const activeLeads = computed(() => salesStore.leads.filter((l) => l.stage !== 'lost' && l.stage !== 'deal').length)
const perM2 = computed(() => avgPricePerM2(unitsStore.units))

const freeUnits = computed(() => unitsStore.units.filter((u) => u.status === 'free'))
const soldShare = computed(() => {
  const total = unitsStore.units.length || 1
  const sold = unitsStore.units.filter((u) => u.status === 'sold' || u.status === 'installment').length
  return Math.round((sold / total) * 100)
})

const metrics = computed<MetricItem[]>(() => [
  {
    key: 'revenue', label: 'Выручка в работе', hero: true,
    value: moneyCompact(revenueInWork.value), unit: 'USD',
    delta: salesDelta.value ? { text: `${Math.abs(salesDelta.value.pct)}% продаж за месяц`, dir: salesDelta.value.dir, good: salesDelta.value.dir === 'up' } : undefined,
    hint: `${soldShare.value}% фонда реализовано`,
    spark: salesSeries.value,
  },
  {
    key: 'receipts', label: 'Поступления за месяц', value: moneyCompact(monthReceipts.value),
    delta: receiptsDelta.value ? { text: `${Math.abs(receiptsDelta.value.pct)}%`, dir: receiptsDelta.value.dir, good: receiptsDelta.value.dir === 'up' } : undefined,
    hint: 'к прошлому месяцу', spark: receiptsSeries.value, tone: 'ok', to: '/payments',
  },
  {
    key: 'debt', label: 'Просрочка по графику', value: moneyCompact(totalDebt.value),
    hint: `${overdueContracts.value.length} договоров`, tone: 'bad', spark: debtSeries.value, to: '/payments',
  },
  {
    key: 'leads', label: 'Заявки в работе', value: String(activeLeads.value),
    delta: leadsDelta.value ? { text: `${Math.abs(leadsDelta.value.pct)}%`, dir: leadsDelta.value.dir, good: leadsDelta.value.dir === 'up' } : undefined,
    hint: 'новых заявок к прошлому месяцу', spark: leadsSeries.value, tone: 'accent', to: '/leads',
  },
  {
    key: 'free', label: 'Свободные квартиры', value: String(freeUnits.value.length),
    hint: `из ${unitsStore.units.length} помещений`, to: '/board',
    meter: { pct: unitsStore.units.length ? Math.round((freeUnits.value.length / unitsStore.units.length) * 100) : 0 },
  },
])

/* --------------------------------- график --------------------------------- */

type Measure = 'sales' | 'deals' | 'receipts'
const measure = ref<Measure>('sales')

const chartPoints = computed(() => {
  const src = { sales: salesSeries.value, deals: dealsSeries.value, receipts: receiptsSeries.value }[measure.value]
  return months.value.map((m, i) => ({
    label: m.label,
    value: src[i] ?? 0,
    display: measure.value === 'deals' ? `${src[i] ?? 0} шт.` : money(src[i] ?? 0),
  }))
})
const chartFormat = computed(() => (measure.value === 'deals'
  ? (v: number) => String(v)
  : (v: number) => moneyCompact(v)))
const chartTotal = computed(() => {
  const src = { sales: salesSeries.value, deals: dealsSeries.value, receipts: receiptsSeries.value }[measure.value]
  const sum = src.reduce((s, v) => s + v, 0)
  return measure.value === 'deals' ? `${sum} сделок за 12 мес.` : `${money(sum)} за 12 мес.`
})

/* ------------------------------ скорость сделки ---------------------------- */

const cycleDays = computed(() => avgDealCycleDays(dealsStore.contracts, salesStore.leads))
const resToContract = computed(() => reservationToContract(salesStore.reservations))
const expiring = computed(() => expiringReservations(salesStore.activeReservations, TODAY, 3)
  .map((x) => ({
    ...x,
    unit: unitsStore.unit(x.reservation.unitId),
    client: salesStore.client(x.reservation.clientId),
  })))

/* ----------------------------- требует внимания ---------------------------- */

const staleLeads = computed(() => salesStore.leads.filter((l) => salesStore.taskState(l) === 'none'
  && l.stage !== 'lost' && l.stage !== 'deal').length)
const overdueTasks = computed(() => salesStore.leads.filter((l) => salesStore.taskState(l) === 'overdue').length)
const draftPrices = computed(() => usePricingStore().drafts.filter((d) => d.status === 'draft').length)

const attention = computed(() => [
  { key: 'approval', label: 'Скидки на согласовании', count: approvalsStore.pending.length, tone: 'warn' as const, icon: 'ph:percent', to: '/approvals' },
  { key: 'pay', label: 'Платежи на подтверждении', count: dealsStore.pendingPayments.length, tone: 'warn' as const, icon: 'ph:hand-coins', to: '/payments' },
  { key: 'debt', label: 'Договоры с просрочкой', count: overdueContracts.value.length, tone: 'bad' as const, icon: 'ph:warning-circle', to: '/contracts' },
  { key: 'res', label: 'Брони истекают за 3 дня', count: expiring.value.length, tone: 'warn' as const, icon: 'ph:hourglass', to: '/board' },
  { key: 'task', label: 'Просроченные задачи', count: overdueTasks.value, tone: 'bad' as const, icon: 'ph:clock-countdown', to: '/leads' },
  { key: 'lead', label: 'Заявки без следующего шага', count: staleLeads.value, tone: 'info' as const, icon: 'ph:chat-dots', to: '/leads' },
  { key: 'price', label: 'Черновики прайс-листов', count: draftPrices.value, tone: 'neutral' as const, icon: 'ph:tag', to: '/pricing' },
].filter((r) => r.count > 0))

/* --------------------------------- воронка -------------------------------- */

const funnelStages = computed(() => stageFunnel(salesStore.leads, LEAD_PIPELINE, (s) => LEAD_STAGE_META[s].label))
const lostLeads = computed(() => salesStore.leadsByStage('lost').length)
const funnelConversion = computed(() => {
  const first = funnelStages.value[0]?.count ?? 0
  const last = funnelStages.value[funnelStages.value.length - 1]?.count ?? 0
  return first ? Math.round((last / first) * 100) : 0
})
/** Самый узкий переход воронки — там и теряются деньги. */
const worstStep = computed(() => funnelStages.value
  .filter((s) => s.conversion !== null)
  .sort((a, b) => (a.conversion ?? 100) - (b.conversion ?? 100))[0])

/* ----------------------------- статусы объектов ---------------------------- */

const STATUS_ORDER: UnitStatus[] = ['sold', 'installment', 'reserved', 'free', 'closed']
const STATUS_COLOR: Record<UnitStatus, string> = {
  sold: 'var(--c-sold)', installment: 'var(--c-inst)', reserved: 'var(--c-reserve)',
  free: 'var(--c-free)', closed: 'var(--c-closed)',
}
const statusSegments = computed(() => STATUS_ORDER.map((status) => ({
  key: status,
  label: UNIT_STATUS_META[status].label,
  value: unitsStore.units.filter((u) => u.status === status).length,
  color: STATUS_COLOR[status],
})))

/* --------------------------------- оплаты --------------------------------- */

const buckets = ['soon', 'today', 'd1_7', 'd8_30', 'd30_plus'] as const
const bucketCounts = computed(() => buckets.map((b) => ({
  key: b,
  count: dealsStore.contracts.filter((c) => c.status === 'active' && dealsStore.paymentBoardBucket(c.id) === b).length,
})))
const planFact = computed(() => planFactSeries(lastMonths(TODAY, 8), dealsStore.scheduleItems, dealsStore.payments))

/* ------------------------------- разрезы KPI ------------------------------- */

const byProject = computed(() => salesByProject(dealsStore.contracts, (id) => unitsStore.project(id)?.name ?? '—'))
const byManager = computed(() => salesByManager(dealsStore.contracts, salesStore.leads,
  (id) => settingsStore.users.find((u) => u.id === id)?.name ?? '—'))
const bySource = computed(() => leadSourceStats(salesStore.leads))

/* -------------------------------- проекты --------------------------------- */

const projectRows = computed(() => unitsStore.projects.filter((p) => !p.archived).map((p) => ({
  project: p,
  stats: unitsStore.projectStats(p.id),
  buildings: unitsStore.buildingsByProject(p.id).length,
})))

/* ------------------------------ последние сделки --------------------------- */

const recentContracts = computed(() => [...dealsStore.contracts]
  .sort((a, b) => (b.signedAt ?? '').localeCompare(a.signedAt ?? ''))
  .slice(0, 6)
  .map((c) => ({
    contract: c,
    client: salesStore.client(c.clientId),
    unit: unitsStore.unit(c.unitIds[0] ?? ''),
    project: unitsStore.project(c.projectId),
  })))
</script>

<template>
  <div class="flex flex-col gap-5">
    <PageHeader
      title="Дашборд"
      :subtitle="`${fmtDateFull(TODAY.toISOString())} · ${unitsStore.projects.filter((p) => !p.archived).length} проекта · ${unitsStore.units.length} помещений`"
    >
      <template #actions>
        <AppButton icon="ph:grid-nine" @click="navigateTo('/board')">Шахматка</AppButton>
        <AppButton icon="ph:magic-wand" variant="primary" @click="navigateTo('/deals/new')">Новая сделка</AppButton>
      </template>
    </PageHeader>

    <MetricStrip :items="metrics" />

    <!-- динамика + что требует внимания -->
    <div class="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <AppCard title="Динамика по месяцам" :subtitle="chartTotal" class="xl:col-span-2">
        <template #actions>
          <SegmentedControl
            :model-value="measure"
            :options="[
              { value: 'sales', label: 'Продажи' },
              { value: 'deals', label: 'Сделки' },
              { value: 'receipts', label: 'Поступления' },
            ]"
            @update:model-value="measure = $event as Measure"
          />
        </template>
        <ColumnChart
          :points="chartPoints" :height="196" :format-value="chartFormat"
          :value-label="measure === 'deals' ? 'Сделок' : 'Сумма'"
        />
      </AppCard>

      <AppCard title="Требует внимания" subtitle="Задачи, где система ждёт решения">
        <div v-if="attention.length" class="-mx-1.5 flex flex-col">
          <NuxtLink
            v-for="a in attention" :key="a.key" :to="a.to"
            class="flex items-center gap-3 rounded-xl2 px-1.5 py-2 transition-colors hover:bg-soft"
          >
            <span
              class="grid h-8 w-8 shrink-0 place-items-center rounded-xl2"
              :class="{ warn: 'bg-warn-bg text-warn', bad: 'bg-bad-bg text-bad', info: 'bg-info-bg text-info', neutral: 'bg-soft text-muted' }[a.tone]"
            ><Icon :name="a.icon" size="16" /></span>
            <span class="min-w-0 flex-1 text-[13px] text-ink">{{ a.label }}</span>
            <span class="tabular text-[15px] font-semibold text-ink">{{ a.count }}</span>
            <Icon name="ph:caret-right" size="13" class="shrink-0 text-muted" />
          </NuxtLink>
        </div>
        <EmptyState v-else compact icon="ph:check-circle" title="Всё под контролем" text="Нет просрочек, зависших заявок и неподтверждённых платежей" />
      </AppCard>
    </div>

    <!-- деньги: план/факт и скорость сделки -->
    <div class="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <AppCard title="План / факт поступлений" subtitle="План — суммы по графикам, факт — подтверждённые платежи" class="xl:col-span-2">
        <PlanFactChart :points="planFact" />
      </AppCard>

      <AppCard title="Скорость сделки" subtitle="Сколько времени клиент идёт до договора">
        <div class="flex flex-col gap-3.5">
          <div>
            <p class="tabular text-[26px] font-semibold leading-none tracking-[-0.03em] text-ink">
              {{ cycleDays ?? '—' }}<span v-if="cycleDays" class="ml-1 text-[14px] font-medium text-muted">дн.</span>
            </p>
            <p class="mt-1 text-[12px] text-muted">Средний цикл: от заявки до подписанного договора</p>
          </div>

          <div class="border-t border-line pt-3">
            <div class="flex items-baseline justify-between gap-2">
              <p class="text-[12.5px] text-ink">Бронь → договор</p>
              <p class="tabular text-[15px] font-semibold text-ink">{{ resToContract.percent }}%</p>
            </div>
            <ProgressBar :percent="resToContract.percent" tone="ok" :show-label="false" class="mt-1.5" />
            <p class="mt-1 text-[11.5px] text-muted">{{ resToContract.converted }} из {{ resToContract.total }} броней стали договором</p>
          </div>

          <div class="border-t border-line pt-3">
            <div class="flex items-baseline justify-between gap-2">
              <p class="text-[12.5px] text-ink">Просроченные брони</p>
              <p class="tabular text-[15px] font-semibold" :class="expiring.length ? 'text-warn' : 'text-ink'">{{ expiring.length }}</p>
            </div>
            <div v-if="expiring.length" class="mt-1.5 flex flex-col gap-1">
              <NuxtLink
                v-for="x in expiring.slice(0, 4)" :key="x.reservation.id" to="/board"
                class="flex items-center gap-2 rounded-lg bg-soft px-2 py-1 text-[11.5px] hover:bg-line/40"
              >
                <span class="tabular font-semibold">№ {{ x.unit?.number ?? '—' }}</span>
                <span class="min-w-0 flex-1 truncate text-muted">{{ x.client?.name ?? '—' }}</span>
                <StatusTag :tone="x.daysLeft <= 0 ? 'bad' : 'warn'" size="sm">
                  {{ x.daysLeft <= 0 ? 'истекла' : `${x.daysLeft} дн.` }}
                </StatusTag>
              </NuxtLink>
            </div>
            <p v-else class="mt-1 text-[11.5px] text-muted">Все брони в сроке</p>
          </div>
        </div>
      </AppCard>
    </div>

    <!-- воронка / фонд / оплаты -->
    <div class="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <AppCard title="Конверсия по этапам" :subtitle="`Дошли до сделки ${funnelConversion}% · ${lostLeads} отказов`">
        <template #actions>
          <NuxtLink to="/leads" class="text-[12.5px] font-semibold text-plum hover:underline">Все заявки</NuxtLink>
        </template>
        <FunnelBars :stages="funnelStages" />
        <p v-if="worstStep" class="mt-3 flex items-start gap-1.5 rounded-xl2 bg-soft px-2.5 py-2 text-[11.5px] text-muted">
          <Icon name="ph:warning-circle" size="13" class="mt-0.5 shrink-0 text-warn" />
          Самый узкий переход — «{{ worstStep.label }}»: {{ worstStep.conversion }}% от предыдущего этапа
        </p>
      </AppCard>

      <AppCard title="Структура фонда" :subtitle="`${unitsStore.units.length} помещений во всех проектах`">
        <ShareBar :segments="statusSegments" value-label="Помещений" />
      </AppCard>

      <AppCard title="Доска оплат" subtitle="Активные договоры по срокам">
        <div class="-mx-1.5 flex flex-col">
          <NuxtLink
            v-for="b in bucketCounts" :key="b.key" to="/payments"
            class="flex items-center justify-between gap-3 rounded-xl2 px-1.5 py-[9px] transition-colors hover:bg-soft"
          >
            <StatusTag :tone="PAYMENT_BUCKET_META[b.key].tone" dot size="sm">{{ PAYMENT_BUCKET_META[b.key].label }}</StatusTag>
            <span class="tabular text-[14px] font-semibold text-ink">{{ b.count }}</span>
          </NuxtLink>
        </div>
      </AppCard>
    </div>

    <!-- разрезы: ЖК / менеджеры / источники -->
    <div class="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <AppCard title="Продажи по ЖК" subtitle="Сумма договоров за всё время">
        <BarList :rows="byProject" :format-value="(v) => moneyCompact(v)" secondary-label="сделок" />
      </AppCard>

      <AppCard title="Продажи по менеджерам" subtitle="Через заявку, из которой вырос договор">
        <template #actions>
          <NuxtLink to="/users" class="text-[12.5px] font-semibold text-plum hover:underline">Все</NuxtLink>
        </template>
        <BarList :rows="byManager" :format-value="(v) => moneyCompact(v)" secondary-label="сделок" tone="ok" />
      </AppCard>

      <AppCard title="Источники лидов" subtitle="Сколько пришло и сколько дошло до сделки">
        <BarList :rows="bySource" secondary-label="в сделке" tone="muted" />
      </AppCard>
    </div>

    <!-- проекты + свободный фонд -->
    <div class="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <AppCard :padded="false" flush class="xl:col-span-2">
        <SectionHeader title="Проекты" subtitle="Реализация фонда и выручка" to="/objects" class="px-5 pt-5" />
        <div class="overflow-x-auto">
          <table class="data-table">
            <thead>
              <tr>
                <th>Проект</th>
                <th class="text-right">Домов</th>
                <th class="text-right">Помещений</th>
                <th class="text-right">Свободно</th>
                <th class="w-[150px]">Реализация</th>
                <th class="text-right">Выручка</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in projectRows" :key="r.project.id" class="cursor-pointer" @click="navigateTo(`/objects/${r.project.id}`)">
                <td>
                  <div class="flex items-center gap-2.5">
                    <span class="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[10px] font-bold text-white" :style="{ background: r.project.accent }">{{ projectBadge(r.project.name) }}</span>
                    <div class="min-w-0">
                      <p class="truncate text-[13px] font-semibold text-ink">{{ r.project.name }}</p>
                      <p class="truncate text-[11.5px] text-muted">{{ r.project.stage }}</p>
                    </div>
                  </div>
                </td>
                <td class="tabular text-right">{{ r.buildings }}</td>
                <td class="tabular text-right">{{ r.stats.total }}</td>
                <td class="tabular text-right font-semibold">{{ r.stats.free }}</td>
                <td>
                  <div class="flex items-center gap-2">
                    <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-soft">
                      <span class="block h-full rounded-full bg-chart-accent" :style="{ width: `${r.stats.soldPct}%` }" />
                    </div>
                    <span class="tabular w-8 text-right text-[12px] font-semibold">{{ r.stats.soldPct }}%</span>
                  </div>
                </td>
                <td class="tabular text-right font-semibold">{{ moneyCompact(r.stats.revenue, r.project.currency) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </AppCard>

      <AppCard title="Журнал" subtitle="Последние действия в системе">
        <div class="flex flex-col">
          <div v-for="a in miscStore.audit.slice(0, 7)" :key="a.id" class="flex items-start gap-2.5 border-b border-line py-2 last:border-0">
            <span class="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-chart-accent" />
            <div class="min-w-0">
              <p class="text-[12.5px] leading-snug text-ink">{{ a.text }}</p>
              <p class="mt-0.5 text-[11.5px] text-muted">{{ a.module }} · {{ a.author }}</p>
            </div>
          </div>
        </div>
      </AppCard>
    </div>

    <!-- сделки -->
    <AppCard :padded="false" flush>
      <SectionHeader title="Последние договоры" subtitle="Свежие сделки по всем проектам" to="/contracts" class="px-5 pt-5" />
      <div class="overflow-x-auto">
        <table class="data-table">
          <thead><tr><th>Договор</th><th>Клиент</th><th>Объект</th><th>Подписан</th><th class="text-right">Сумма</th><th>Статус</th></tr></thead>
          <tbody>
            <tr v-for="r in recentContracts" :key="r.contract.id" class="cursor-pointer" @click="navigateTo(`/contracts/${r.contract.id}`)">
              <td class="tabular font-medium">{{ r.contract.number }}</td>
              <td class="truncate">{{ r.client?.name ?? '—' }}</td>
              <td class="text-muted">{{ r.project?.name }} · № {{ r.unit?.number ?? '—' }}</td>
              <td class="text-muted">{{ r.contract.signedAt ? fmtDate(r.contract.signedAt) : '—' }}</td>
              <td class="tabular text-right font-semibold">{{ money(r.contract.price, r.contract.currency) }}</td>
              <td><StatusTag size="sm" :tone="r.contract.status === 'paid' ? 'ok' : r.contract.status === 'active' ? 'info' : 'neutral'">{{ r.contract.status === 'paid' ? 'Оплачен' : r.contract.status === 'active' ? 'Активен' : 'Черновик' }}</StatusTag></td>
            </tr>
          </tbody>
        </table>
      </div>
    </AppCard>
  </div>
</template>
