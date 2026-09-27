<script setup lang="ts">
import type { Contract } from '~/types/models'
import type { ContextAction } from '~/components/ui/ContextMenu.vue'
import { CONTRACT_STATUS_META, DEAL_TYPE_META } from '~/utils/meta'
import { fmtDate, money } from '~/utils/format'
import type { ContractStatus } from '~/types/models'

definePageMeta({ breadcrumb: [{ label: 'Договоры' }, { label: 'Список договоров' }] })

const dealsStore = useDealsStore()
const salesStore = useSalesStore()
const unitsStore = useUnitsStore()
const { seesEveryone, myId } = useAccess()

/** Менеджер работает своими сделками: чужие договоры ему не показываем. */
function mine(contract: { leadId?: string }) {
  if (seesEveryone.value) return true
  return Boolean(contract.leadId && salesStore.lead(contract.leadId)?.assignedTo === myId.value)
}

const search = ref('')
const statusFilter = ref<ContractStatus | ''>('')

const rows = computed(() => dealsStore.contracts
  .filter(mine)
  .filter((c) => (!statusFilter.value || c.status === statusFilter.value))
  .filter((c) => !search.value || c.number.toLowerCase().includes(search.value.toLowerCase()) || salesStore.client(c.clientId)?.name.toLowerCase().includes(search.value.toLowerCase()))
  .sort((a, b) => b.createdAt.localeCompare(a.createdAt)))

/* ------------------------- настройка и управление ------------------------- */

const COLS = ['number', 'client', 'unit', 'type', 'price', 'debt', 'status', 'created'] as const
const { style: colStyle, start: startResize, reset: resetColumn, active: resizing } = useColumnResize('contracts')

const { cursor } = useRowNavigation({
  count: () => rows.value.length,
  onOpen: (i) => { const c = rows.value[i]; if (c) navigateTo(`/contracts/${c.id}`) },
})

const menu = useContextMenu<Contract>()
const ui = useUiStore()

const menuActions = computed<ContextAction[]>(() => {
  const c = menu.row.value
  return [
    { key: 'open', label: 'Открыть договор', icon: 'ph:arrow-square-out', hint: '↵' },
    { key: 'client', label: 'Открыть клиента', icon: 'ph:address-book', disabled: !c?.clientId },
    { key: 'unit', label: 'Открыть помещение', icon: 'ph:grid-nine', disabled: !c?.unitIds.length },
    { key: 'call', label: 'Позвонить клиенту', icon: 'ph:phone', separated: true, disabled: !salesStore.client(c?.clientId ?? '')?.phone },
    { key: 'copy', label: 'Скопировать номер', icon: 'ph:copy' },
  ]
})

function onMenuPick(key: string) {
  const c = menu.row.value
  if (!c) return
  if (key === 'open') navigateTo(`/contracts/${c.id}`)
  if (key === 'client') navigateTo('/clients')
  if (key === 'unit' && c.unitIds[0]) {
    const unit = unitsStore.unit(c.unitIds[0])
    if (unit) navigateTo(`/board?building=${unit.buildingId}&unit=${unit.id}`)
  }
  if (key === 'call') {
    const phone = salesStore.client(c.clientId)?.phone
    if (phone) window.open(`tel:+${phone}`)
  }
  if (key === 'copy') {
    navigator.clipboard?.writeText(c.number)
    ui.toast(`Номер ${c.number} скопирован`, 'ok')
  }
}
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

    <div class="table-scroll rounded-card border border-line">
      <table class="data-table">
        <thead>
          <tr>
            <th
              v-for="(label, i) in ['№ договора', 'Клиент', 'Объект', 'Тип', 'Сумма', 'Долг', 'Статус', 'Создан']"
              :key="label" :style="colStyle(COLS[i]!)"
            >
              {{ label }}
              <span
                class="col-grip" :class="resizing === COLS[i] ? 'is-active' : ''"
                title="Потяните, чтобы изменить ширину; двойной клик — автоширина"
                @pointerdown="startResize(COLS[i]!, $event)" @dblclick.stop="resetColumn(COLS[i]!)" @click.stop
              />
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(c, i) in rows" :key="c.id" class="cursor-pointer"
            :class="cursor === i ? 'is-cursor' : ''" :data-row-index="i"
            @click="navigateTo(`/contracts/${c.id}`)"
            @contextmenu="menu.open($event, c)"
          >
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

      <ContextMenu
        :x="menu.x.value" :y="menu.y.value" :actions="menuActions"
        :title="menu.row.value?.number" @pick="onMenuPick" @close="menu.close()"
      />
    </div>
  </div>
</template>
