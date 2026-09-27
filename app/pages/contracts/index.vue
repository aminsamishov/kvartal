<script setup lang="ts">
import { CONTRACT_STATUS_META, DEAL_TYPE_META } from '~/utils/meta'
import { fmtDate, money } from '~/utils/format'
import type { ContractStatus } from '~/types/models'

definePageMeta({ breadcrumb: [{ label: 'Договоры' }, { label: 'Список договоров' }] })

const dealsStore = useDealsStore()
const salesStore = useSalesStore()
const unitsStore = useUnitsStore()

const search = ref('')
const statusFilter = ref<ContractStatus | ''>('')

const rows = computed(() => dealsStore.contracts
  .filter((c) => (!statusFilter.value || c.status === statusFilter.value))
  .filter((c) => !search.value || c.number.toLowerCase().includes(search.value.toLowerCase()) || salesStore.client(c.clientId)?.name.toLowerCase().includes(search.value.toLowerCase()))
  .sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
</script>

<template>
  <div class="flex flex-col gap-5">
    <div>
      <h1 class="text-[22px] font-semibold tracking-[-0.025em]">Договоры</h1>
      <p class="mt-1 text-[13px] text-muted">Договор, состав сделки, график, допсоглашения</p>
    </div>

    <div class="flex flex-wrap gap-2">
      <AppInput v-model="search" placeholder="Номер или клиент" icon="ph:magnifying-glass" class="w-[220px]" />
      <AppSelect
        v-model="statusFilter" class="w-[200px]"
        :options="[{ value: '', label: 'Все статусы' }, ...Object.entries(CONTRACT_STATUS_META).map(([v, m]) => ({ value: v, label: m.label }))]"
      />
    </div>

    <div class="overflow-x-auto rounded-card border border-line">
      <table class="data-table">
        <thead><tr><th>№ договора</th><th>Клиент</th><th>Объект</th><th>Тип</th><th>Сумма</th><th>Долг</th><th>Статус</th><th>Создан</th></tr></thead>
        <tbody>
          <tr v-for="c in rows" :key="c.id" class="cursor-pointer" @click="navigateTo(`/contracts/${c.id}`)">
            <td class="font-semibold text-plum">{{ c.number }}</td>
            <td>{{ salesStore.client(c.clientId)?.name }}</td>
            <td class="tabular">{{ c.unitIds.map((id) => unitsStore.unit(id)?.number).join(', ') }}</td>
            <td>{{ DEAL_TYPE_META[c.dealType] }}</td>
            <td class="tabular">{{ money(c.price, c.currency) }}</td>
            <td class="tabular" :class="dealsStore.balance(c.id).overdueAmount ? 'font-semibold text-bad' : 'text-muted'">
              {{ dealsStore.balance(c.id).overdueAmount ? money(dealsStore.balance(c.id).overdueAmount, c.currency) : '—' }}
            </td>
            <td><StatusTag :tone="CONTRACT_STATUS_META[c.status].tone" size="sm">{{ CONTRACT_STATUS_META[c.status].label }}</StatusTag></td>
            <td class="text-muted">{{ fmtDate(c.createdAt) }}</td>
          </tr>
        </tbody>
      </table>
      <EmptyState v-if="!rows.length" compact icon="ph:file-text" title="Договоры не найдены" />
    </div>
  </div>
</template>
