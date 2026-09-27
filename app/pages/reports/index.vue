<script setup lang="ts">
import { moneyCompact } from '~/utils/format'
import { TODAY } from '~/data/seed'
import { USERS } from '~/data/catalog'

definePageMeta({ breadcrumb: [{ label: 'Отчёты' }, { label: 'Аналитика' }] })

const dealsStore = useDealsStore()
const salesStore = useSalesStore()
const unitsStore = useUnitsStore()

const MONTHS = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек']

const monthly = computed(() => {
  const result: { label: string; receipts: number; deals: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(TODAY.getFullYear(), TODAY.getMonth() - i, 1)
    const receipts = dealsStore.payments.filter((p) => p.status === 'confirmed' && new Date(p.date).getMonth() === d.getMonth() && new Date(p.date).getFullYear() === d.getFullYear())
      .reduce((s, p) => s + p.amount, 0)
    const deals = dealsStore.contracts.filter((c) => new Date(c.createdAt).getMonth() === d.getMonth() && new Date(c.createdAt).getFullYear() === d.getFullYear()).length
    result.push({ label: MONTHS[d.getMonth()]!, receipts, deals })
  }
  return result
})
const maxReceipts = computed(() => Math.max(1, ...monthly.value.map((m) => m.receipts)))

const managers = USERS.filter((u) => u.role === 'manager')
const managerStats = computed(() => managers.map((m) => {
  const leads = salesStore.leads.filter((l) => l.assignedTo === m.id)
  const deals = leads.filter((l) => l.stage === 'deal').length
  const conversion = leads.length ? Math.round((deals / leads.length) * 100) : 0
  return { manager: m, leadsCount: leads.length, deals, conversion }
}).sort((a, b) => b.deals - a.deals))

const projectRows = computed(() => unitsStore.projects.map((p) => ({ project: p, stats: unitsStore.projectStats(p.id) })))
</script>

<template>
  <div class="flex flex-col gap-5">
    <div>
      <h1 class="text-[22px] font-semibold tracking-[-0.025em]">Аналитика</h1>
      <p class="mt-1 text-[13px] text-muted">Продажи, поступления и конверсия — на данных amoCRM и платформы</p>
    </div>

    <AppCard title="Поступления за 6 месяцев" subtitle="Подтверждённые платежи по месяцам">
      <div class="flex h-[180px] items-end gap-3">
        <div v-for="m in monthly" :key="m.label" class="flex flex-1 flex-col items-center gap-2">
          <span class="text-[11px] font-semibold tabular text-muted">{{ moneyCompact(m.receipts) }}</span>
          <div class="w-full rounded-t-lg bg-plum transition-all" :style="{ height: `${Math.max(4, (m.receipts / maxReceipts) * 120)}px` }" />
          <span class="text-[11.5px] text-muted">{{ m.label }}</span>
        </div>
      </div>
    </AppCard>

    <div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <AppCard title="Менеджеры" subtitle="Заявки → сделки">
        <div class="flex flex-col gap-2.5">
          <div v-for="row in managerStats" :key="row.manager.id" class="flex items-center gap-3">
            <AppAvatar :name="row.manager.name" :color="row.manager.avatarColor" size="sm" />
            <div class="min-w-0 flex-1">
              <p class="truncate text-[13px] font-medium">{{ row.manager.name }}</p>
              <div class="mt-1 h-1.5 overflow-hidden rounded-full bg-soft"><div class="h-full rounded-full bg-ok" :style="{ width: `${row.conversion}%` }" /></div>
            </div>
            <span class="tabular text-[12.5px] text-muted">{{ row.deals }}/{{ row.leadsCount }}</span>
            <span class="tabular w-10 text-right text-[12.5px] font-semibold">{{ row.conversion }}%</span>
          </div>
        </div>
      </AppCard>

      <AppCard title="Проекты" subtitle="Динамика продаж по ЖК">
        <div class="flex flex-col gap-3.5">
          <div v-for="row in projectRows" :key="row.project.id">
            <div class="flex items-center justify-between text-[13px]">
              <span class="font-medium">{{ row.project.name }}</span>
              <span class="tabular text-muted">{{ row.stats.soldPct }}%</span>
            </div>
            <ProgressBar :percent="row.stats.soldPct" tone="plum" :show-label="false" class="mt-1.5" />
          </div>
        </div>
      </AppCard>
    </div>
  </div>
</template>
