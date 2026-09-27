<script setup lang="ts">
import { CONTRACT_STATUS_META, DEAL_TYPE_META, PAYMENT_KIND_META, PAYMENT_STATUS_META } from '~/utils/meta'
import { fmtDate, fmtDateTime, fmtPhone, money } from '~/utils/format'
import { TODAY } from '~/data/seed'
import type { PaymentKind } from '~/types/models'

const route = useRoute()
const dealsStore = useDealsStore()
const salesStore = useSalesStore()
const unitsStore = useUnitsStore()
const settingsStore = useSettingsStore()
const misc = useMiscStore()
const auth = useAuthStore()
const ui = useUiStore()

const contract = computed(() => dealsStore.contract(route.params.id as string))
useBreadcrumb(() => [{ label: 'Договоры', to: '/contracts' }, { label: contract.value?.number ?? '…' }])

const client = computed(() => (contract.value ? salesStore.client(contract.value.clientId) : undefined))
const units = computed(() => (contract.value ? contract.value.unitIds.map((id) => unitsStore.unit(id)).filter(Boolean) : []))
const balance = computed(() => (contract.value ? dealsStore.balance(contract.value.id) : null))
const schedule = computed(() => (contract.value ? dealsStore.scheduleFor(contract.value.id) : []))
const payments = computed(() => (contract.value ? dealsStore.paymentsFor(contract.value.id) : []))

const tab = ref<'schedule' | 'payments' | 'documents'>('schedule')

function rowState(dueDate: string, amount: number, paid: number) {
  if (paid >= amount) return { label: 'Оплачено', tone: 'ok' as const }
  if (new Date(dueDate) < TODAY) return { label: 'Просрочено', tone: 'bad' as const }
  return { label: 'Ожидается', tone: 'neutral' as const }
}

function approve() {
  if (!contract.value) return
  contract.value.status = 'active'
  misc.log('Договоры', `Договор ${contract.value.number} согласован`, auth.user?.name ?? '')
  ui.toast('Договор согласован и активирован', 'ok')
}
function reject() {
  if (!contract.value) return
  contract.value.status = 'terminated'
  misc.log('Договоры', `Договор ${contract.value.number} отклонён на согласовании`, auth.user?.name ?? '')
  ui.toast('Договор отклонён', 'bad')
}

const showPayForm = ref(false)
const payAmount = ref(0)
const payKind = ref<PaymentKind>('bank')
async function submitPayment() {
  if (!contract.value || payAmount.value <= 0) return
  await dealsStore.registerPayment(contract.value.id, payAmount.value, payKind.value)
  ui.toast('Платёж зарегистрирован, ждёт подтверждения бухгалтера', 'info')
  showPayForm.value = false
  payAmount.value = 0
}

async function confirmPayment(id: string) {
  await dealsStore.confirmPayment(id)
  misc.log('Платежи', `Подтверждён платёж по договору ${contract.value?.number}`, auth.user?.name ?? '')
  ui.toast('Платёж подтверждён', 'ok')
}
async function rejectPayment(id: string) {
  await dealsStore.rejectPayment(id)
  ui.toast('Платёж отклонён', 'bad')
}

function generateDoc(name: string, process: string) {
  misc.generateDocument({ templateName: name, process, contractNumber: contract.value?.number, clientName: client.value?.name, createdBy: auth.user?.name ?? '' })
  ui.toast(`«${name}» сформирован и сохранён в документах`, 'ok')
}
</script>

<template>
  <div v-if="contract" class="flex flex-col gap-5">
    <div class="flex flex-wrap items-start justify-between gap-4 rounded-card border border-line bg-panel p-5">
      <div>
        <div class="flex items-center gap-2">
          <h1 class="text-[21px] font-semibold tracking-[-0.02em]">{{ contract.number }}</h1>
          <StatusTag :tone="CONTRACT_STATUS_META[contract.status].tone">{{ CONTRACT_STATUS_META[contract.status].label }}</StatusTag>
        </div>
        <p class="mt-1.5 flex items-center gap-1.5 text-[13.5px]">
          <AppAvatar v-if="client" :name="client.name" size="sm" /> {{ client?.name }} <span class="text-muted">· {{ client ? fmtPhone(client.phone) : '' }}</span>
        </p>
        <p class="mt-1 text-[12.5px] text-muted">
          {{ units.map((u) => `№ ${u!.number}`).join(', ') }} · {{ DEAL_TYPE_META[contract.dealType] }} · создан {{ fmtDate(contract.createdAt) }}
        </p>
      </div>
      <div v-if="contract.status === 'pending_approval'" class="flex gap-2">
        <AppButton variant="danger" icon="ph:x" @click="reject">Отклонить</AppButton>
        <AppButton variant="primary" icon="ph:check-bold" @click="approve">Согласовать</AppButton>
      </div>
    </div>

    <MetricStrip
      v-if="balance" :items="[
        { key: 'price', label: 'Цена договора', value: money(balance.price, contract.currency) },
        { key: 'paid', label: 'Оплачено', value: money(balance.paid, contract.currency), hint: `${Math.round((balance.paid / (balance.price || 1)) * 100)}% от суммы` },
        { key: 'rest', label: 'Остаток', value: money(balance.remaining, contract.currency) },
        { key: 'overdue', label: 'Просрочка', value: balance.overdueAmount ? money(balance.overdueAmount, contract.currency) : '—', hint: balance.overdueDays ? `${balance.overdueDays} дн. максимум` : 'график соблюдается' },
      ]"
    />

    <Tabs
      v-model="tab" :tabs="[
        { value: 'schedule', label: 'График платежей', icon: 'ph:calendar-check', count: schedule.length },
        { value: 'payments', label: 'Платежи', icon: 'ph:hand-coins', count: payments.length },
        { value: 'documents', label: 'Документы', icon: 'ph:files' },
      ]"
    />

    <div v-if="tab === 'schedule'" class="overflow-x-auto rounded-card border border-line">
      <table class="data-table">
        <thead><tr><th>Срок</th><th>Сумма</th><th>Оплачено</th><th>Остаток</th><th>Статус</th></tr></thead>
        <tbody>
          <tr v-for="s in schedule" :key="s.id">
            <td>{{ fmtDate(s.dueDate) }}</td>
            <td class="tabular">{{ money(s.amount, contract.currency) }}</td>
            <td class="tabular text-ok">{{ money(s.paid, contract.currency) }}</td>
            <td class="tabular">{{ money(s.amount - s.paid, contract.currency) }}</td>
            <td><StatusTag :tone="rowState(s.dueDate, s.amount, s.paid).tone" size="sm">{{ rowState(s.dueDate, s.amount, s.paid).label }}</StatusTag></td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else-if="tab === 'payments'" class="flex flex-col gap-3.5">
      <div class="flex justify-end">
        <AppButton variant="primary" icon="ph:plus-bold" @click="showPayForm = true">Зарегистрировать платёж</AppButton>
      </div>
      <div class="overflow-x-auto rounded-card border border-line">
        <table class="data-table">
          <thead><tr><th>Дата</th><th>Сумма</th><th>Способ</th><th>Статус</th><th>Чек</th><th /></tr></thead>
          <tbody>
            <tr v-for="p in payments" :key="p.id">
              <td>{{ fmtDateTime(p.date) }}</td>
              <td class="tabular font-semibold">{{ money(p.amount, p.currency) }}</td>
              <td>{{ PAYMENT_KIND_META[p.kind] }}</td>
              <td><StatusTag :tone="PAYMENT_STATUS_META[p.status].tone" size="sm">{{ PAYMENT_STATUS_META[p.status].label }}</StatusTag></td>
              <td class="text-muted">{{ p.receiptNumber ?? '—' }}</td>
              <td>
                <div v-if="p.status === 'pending'" class="flex gap-1.5">
                  <AppButton size="sm" variant="primary" @click="confirmPayment(p.id)">Подтвердить</AppButton>
                  <AppButton size="sm" variant="ghost" @click="rejectPayment(p.id)">Отклонить</AppButton>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        <EmptyState v-if="!payments.length" compact icon="ph:hand-coins" title="Платежей пока нет" />
      </div>
    </div>

    <div v-else class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div v-for="t in settingsStore.docTemplates.filter((t) => t.active)" :key="t.id" class="flex items-center justify-between rounded-xl2 border border-line p-3.5">
        <div>
          <p class="text-[13px] font-semibold">{{ t.name }}</p>
          <p class="text-[11.5px] text-muted">{{ t.process }} · {{ t.source }}</p>
        </div>
        <AppButton size="sm" icon="ph:file-arrow-down" @click="generateDoc(t.name, t.process)">Сформировать</AppButton>
      </div>
    </div>

    <AppModal v-model="showPayForm" title="Новый платёж" width="sm">
      <div class="flex flex-col gap-3.5">
        <AppInput v-model.number="payAmount" type="number" label="Сумма" :suffix="contract.currency" />
        <AppSelect v-model="payKind" label="Способ" :options="Object.entries(PAYMENT_KIND_META).map(([v, l]) => ({ value: v, label: l }))" />
        <AppButton variant="primary" block @click="submitPayment">Зарегистрировать</AppButton>
      </div>
    </AppModal>
  </div>
  <EmptyState v-else icon="ph:question" title="Договор не найден" class="mt-10" />
</template>
