<script setup lang="ts">
import { TODAY } from '~/data/seed'
import { LEAD_STAGE_META, PAYMENT_BUCKET_META, UNIT_STATUS_META } from '~/utils/meta'
import { fmtDateFull, money, moneyCompact, projectBadge } from '~/utils/format'
import { avgPricePerM2, lastMonths, managerRows, momDelta, seriesBy } from '~/utils/analytics'
import type { MetricItem } from '~/components/dashboard/MetricStrip.vue'
import type { LeadStage, UnitStatus } from '~/types/models'

definePageMeta({ breadcrumb: [{ label: 'Дашборд' }] })

const unitsStore = useUnitsStore()
const salesStore = useSalesStore()
const dealsStore = useDealsStore()
const settingsStore = useSettingsStore()
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
    key: 'm2', label: 'Средняя цена м²', value: money(perM2.value), hint: 'по фонду в продаже',
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

/* ----------------------------- требует внимания ---------------------------- */

const expiringReservations = computed(() => salesStore.activeReservations
  .filter((r) => (new Date(r.expiresAt).getTime() - TODAY.getTime()) / 86400000 <= 3).length)
const staleLeads = computed(() => salesStore.leads.filter((l) => l.stage !== 'lost' && l.stage !== 'deal' && !l.nextAction).length)
const draftPrices = computed(() => usePricingStore().drafts.filter((d) => d.status === 'draft').length)

const attention = computed(() => [
  { key: 'pay', label: 'Платежи на подтверждении', count: dealsStore.pendingPayments.length, tone: 'warn' as const, icon: 'ph:hand-coins', to: '/payments' },
  { key: 'debt', label: 'Договоры с просрочкой', count: overdueContracts.value.length, tone: 'bad' as const, icon: 'ph:warning-circle', to: '/contracts' },
  { key: 'res', label: 'Брони истекают за 3 дня', count: expiringReservations.value, tone: 'warn' as const, icon: 'ph:hourglass', to: '/board' },
  { key: 'lead', label: 'Заявки без следующего шага', count: staleLeads.value, tone: 'info' as const, icon: 'ph:chat-dots', to: '/leads' },
  { key: 'price', label: 'Черновики прайс-листов', count: draftPrices.value, tone: 'neutral' as const, icon: 'ph:tag', to: '/pricing' },
].filter((r) => r.count > 0))

/* --------------------------------- воронка -------------------------------- */

// Заявка стоит ровно на одном этапе, поэтому «дошли до этапа» = все заявки,
// чей этап не раньше текущего. Отказы исключаем: как далеко такая заявка
// продвинулась до отказа, система не хранит — её считаем отдельной строкой.
const FUNNEL: LeadStage[] = ['new', 'contacted', 'visit', 'reserved', 'deal']
const funnelStages = computed(() => {
  const live = salesStore.leads.filter((l) => l.stage !== 'lost')
  return FUNNEL.map((stage, i) => ({
    key: stage,
    label: LEAD_STAGE_META[stage].label,
    count: live.filter((l) => FUNNEL.indexOf(l.stage) >= i).length,
  }))
})
const lostLeads = computed(() => salesStore.leadsByStage('lost').length)
const funnelConversion = computed(() => {
  const first = funnelStages.value[0]?.count ?? 0
  const last = funnelStages.value[funnelStages.value.length - 1]?.count ?? 0
  return first ? Math.round((last / first) * 100) : 0
})

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

/* -------------------------------- проекты --------------------------------- */

const projectRows = computed(() => unitsStore.projects.filter((p) => !p.archived).map((p) => ({
  project: p,
  stats: unitsStore.projectStats(p.id),
  buildings: unitsStore.buildingsByProject(p.id).length,
})))

/* ------------------------------- менеджеры -------------------------------- */

const managers = computed(() => {
  const list = settingsStore.users.filter((u) => u.role === 'manager' && u.active)
  return managerRows(list.map((u) => u.id), salesStore.leads, salesStore.reservations)
    .map((row) => ({ ...row, user: list.find((u) => u.id === row.id)! }))
    .filter((r) => r.user)
})

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
            class="flex items-center gap-3 rounded-xl2 px-1.5 py-2.5 transition-colors hover:bg-soft"
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

    <!-- воронка / фонд / оплаты -->
    <div class="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <AppCard title="Воронка заявок" :subtitle="`Дошли до сделки ${funnelConversion}% · ${lostLeads} отказов`">
        <template #actions>
          <NuxtLink to="/leads" class="text-[12.5px] font-semibold text-plum hover:underline">Все заявки</NuxtLink>
        </template>
        <FunnelBars :stages="funnelStages" />
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

    <!-- проекты + менеджеры -->
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
                <td class="tabular text-right">{{ r.stats.free }}</td>
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

      <AppCard title="Менеджеры" subtitle="Заявки и конверсия в сделку">
        <template #actions>
          <NuxtLink to="/users" class="text-[12.5px] font-semibold text-plum hover:underline">Все</NuxtLink>
        </template>
        <div class="flex flex-col gap-3">
          <div v-for="m in managers" :key="m.id" class="flex items-center gap-2.5">
            <AppAvatar :name="m.user.name" :color="m.user.avatarColor" size="sm" />
            <div class="min-w-0 flex-1">
              <div class="flex items-baseline justify-between gap-2">
                <p class="truncate text-[12.5px] font-medium text-ink">{{ m.user.name }}</p>
                <p class="tabular shrink-0 text-[12.5px] font-semibold text-ink">{{ m.deals }} <span class="font-normal text-muted">из {{ m.leads }}</span></p>
              </div>
              <div class="mt-1 flex items-center gap-2">
                <div class="h-[5px] flex-1 overflow-hidden rounded-full bg-chart-accent/15">
                  <span class="block h-full rounded-full bg-chart-accent" :style="{ width: `${Math.min(100, m.conversion)}%` }" />
                </div>
                <span class="tabular w-8 shrink-0 text-right text-[11px] text-muted">{{ m.conversion }}%</span>
              </div>
            </div>
          </div>
          <EmptyState v-if="!managers.length" compact icon="ph:users" title="Менеджеры не назначены" />
        </div>
      </AppCard>
    </div>

    <!-- сделки + журнал -->
    <div class="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <AppCard :padded="false" flush class="xl:col-span-2">
        <SectionHeader title="Последние договоры" subtitle="Свежие сделки по всем проектам" to="/contracts" class="px-5 pt-5" />
        <div class="overflow-x-auto">
          <table class="data-table">
            <thead><tr><th>Договор</th><th>Клиент</th><th>Объект</th><th class="text-right">Сумма</th><th>Статус</th></tr></thead>
            <tbody>
              <tr v-for="r in recentContracts" :key="r.contract.id" class="cursor-pointer" @click="navigateTo(`/contracts/${r.contract.id}`)">
                <td class="tabular font-medium">{{ r.contract.number }}</td>
                <td class="truncate">{{ r.client?.name ?? '—' }}</td>
                <td class="text-muted">{{ r.project?.name }} · № {{ r.unit?.number ?? '—' }}</td>
                <td class="tabular text-right font-semibold">{{ money(r.contract.price, r.contract.currency) }}</td>
                <td><StatusTag size="sm" :tone="r.contract.status === 'paid' ? 'ok' : r.contract.status === 'active' ? 'info' : 'neutral'">{{ r.contract.status === 'paid' ? 'Оплачен' : r.contract.status === 'active' ? 'Активен' : 'Черновик' }}</StatusTag></td>
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
  </div>
</template>
