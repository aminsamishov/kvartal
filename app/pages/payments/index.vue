<script setup lang="ts">
import { PAYMENT_BUCKET_META, PAYMENT_KIND_META, PAYMENT_STATUS_META } from '~/utils/meta'
import { fmtDate, fmtDateTime, money } from '~/utils/format'

definePageMeta({ breadcrumb: [{ label: 'Платежи' }, { label: 'Доска оплат' }] })

const dealsStore = useDealsStore()
const salesStore = useSalesStore()
const ui = useUiStore()
const { can, seesEveryone, myId } = useAccess()

const buckets = ['soon', 'today', 'd1_7', 'd8_30', 'd30_plus'] as const

/** Менеджеру доска показывает платежи его клиентов, финансам — все. */
function mine(contract: { leadId?: string }) {
  if (seesEveryone.value) return true
  return Boolean(contract.leadId && salesStore.lead(contract.leadId)?.assignedTo === myId.value)
}

function contractsIn(bucket: (typeof buckets)[number]) {
  return dealsStore.contracts.filter((c) => c.status === 'active' && mine(c) && dealsStore.paymentBoardBucket(c.id) === bucket)
}

const canConfirm = computed(() => can('payments.confirm'))
const pending = computed(() => (canConfirm.value ? dealsStore.pendingPayments : []))

async function confirm(id: string) {
  await dealsStore.confirmPayment(id)
  ui.toast('Платёж подтверждён', 'ok')
}
async function reject(id: string) {
  await dealsStore.rejectPayment(id)
  ui.toast('Платёж отклонён', 'bad')
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div>
      <h1 class="text-[22px] font-semibold tracking-[-0.025em]">Доска оплат</h1>
      <p class="mt-1 text-[13px] text-muted">Активные договоры, сгруппированные по срокам ближайшего платежа</p>
    </div>

    <AppCard v-if="pending.length" title="Ждут подтверждения" :subtitle="`${pending.length} платежей — проверьте и подтвердите или отклоните`">
      <div class="flex flex-col gap-2">
        <div v-for="p in pending" :key="p.id" class="flex flex-wrap items-center justify-between gap-2 rounded-xl2 border border-line p-3">
          <div>
            <p class="text-[13px] font-semibold">{{ dealsStore.contract(p.contractId)?.number }} · {{ salesStore.client(dealsStore.contract(p.contractId)?.clientId ?? '')?.name }}</p>
            <p class="text-[12px] text-muted">{{ PAYMENT_KIND_META[p.kind] }} · {{ fmtDateTime(p.date) }}</p>
          </div>
          <div class="flex items-center gap-2">
            <span class="tabular text-[14px] font-semibold">{{ money(p.amount, p.currency) }}</span>
            <AppButton size="sm" variant="primary" @click="confirm(p.id)">Подтвердить</AppButton>
            <AppButton size="sm" variant="ghost" @click="reject(p.id)">Отклонить</AppButton>
          </div>
        </div>
      </div>
    </AppCard>

    <div class="flex gap-3.5 overflow-x-auto pb-3">
      <div v-for="b in buckets" :key="b" class="w-[270px] shrink-0">
        <div class="mb-2.5 flex items-center justify-between px-1">
          <StatusTag :tone="PAYMENT_BUCKET_META[b].tone" dot size="sm">{{ PAYMENT_BUCKET_META[b].label }}</StatusTag>
          <span class="tabular text-[12px] text-muted">{{ contractsIn(b).length }}</span>
        </div>
        <div class="flex flex-col gap-2.5">
          <NuxtLink v-for="c in contractsIn(b)" :key="c.id" :to="`/contracts/${c.id}`" class="block rounded-xl2 border border-line bg-panel p-3 hover:shadow-rise">
            <p class="truncate text-[13px] font-semibold">{{ c.number }}</p>
            <p class="truncate text-[12px] text-muted">{{ salesStore.client(c.clientId)?.name }}</p>
            <div class="mt-2 flex items-center justify-between text-[12.5px]">
              <span class="text-muted">След. платёж</span>
              <span class="tabular font-semibold">{{ dealsStore.balance(c.id).nextDue ? fmtDate(dealsStore.balance(c.id).nextDue!.dueDate) : '—' }}</span>
            </div>
            <div v-if="dealsStore.balance(c.id).overdueAmount" class="mt-1 flex items-center justify-between text-[12.5px]">
              <span class="text-bad">Просрочка</span>
              <span class="tabular font-semibold text-bad">{{ money(dealsStore.balance(c.id).overdueAmount, c.currency) }}</span>
            </div>
          </NuxtLink>
          <EmptyState v-if="!contractsIn(b).length" compact icon="ph:check-circle" title="Пусто" />
        </div>
      </div>
    </div>
  </div>
</template>
