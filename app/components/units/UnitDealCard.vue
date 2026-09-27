<script setup lang="ts">
import type { Unit } from '~/types/models'
import { CONTRACT_STATUS_META, DEAL_TYPE_META, PAYMENT_STATUS_META, RESERVATION_KIND_META } from '~/utils/meta'
import { fmtDate, fmtDateTime, fmtPhone, money } from '~/utils/format'

/**
 * Сделка по помещению прямо в его карточке: клиент, договор, деньги и график.
 * Раньше за любой цифрой приходилось уходить в раздел договоров и терять
 * место на шахматке — а вопрос «сколько он уже заплатил» звучит каждый день.
 */
const props = defineProps<{ unit: Unit }>()

const salesStore = useSalesStore()
const dealsStore = useDealsStore()
const settingsStore = useSettingsStore()

const contract = computed(() => (props.unit.contractId ? dealsStore.contract(props.unit.contractId) : undefined))
const balance = computed(() => (contract.value ? dealsStore.balance(contract.value.id) : null))
const schedule = computed(() => (contract.value ? dealsStore.scheduleFor(contract.value.id) : []))
const payments = computed(() => (contract.value ? dealsStore.paymentsFor(contract.value.id) : []))
const reservation = computed(() => salesStore.reservationForUnit(props.unit.id))
const lead = computed(() => {
  const id = contract.value?.leadId ?? reservation.value?.leadId
  return id ? salesStore.lead(id) : undefined
})
const client = computed(() => {
  const id = contract.value?.clientId ?? reservation.value?.clientId
  return id ? salesStore.client(id) : undefined
})
const manager = computed(() => {
  const id = lead.value?.assignedTo ?? reservation.value?.createdBy
  return settingsStore.users.find((u) => u.id === id)
})

const paidPct = computed(() => (balance.value && balance.value.price
  ? Math.round((balance.value.paid / balance.value.price) * 100)
  : 0))
const basePrice = computed(() => {
  const c = contract.value
  if (!c) return props.unit.price
  return c.discount ? Math.round(c.price / (1 - c.discount / 100)) : c.price
})

const nextItems = computed(() => schedule.value.filter((i) => i.paid < i.amount).slice(0, 4))
const paidCount = computed(() => schedule.value.filter((i) => i.paid >= i.amount).length)
const showSchedule = ref(false)
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- договор -->
    <template v-if="contract && balance">
      <div class="rounded-card border border-line p-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <NuxtLink :to="`/contracts/${contract.id}`" class="tabular text-[14px] font-semibold text-ink hover:text-plum hover:underline">
            {{ contract.number }}
          </NuxtLink>
          <StatusTag :tone="CONTRACT_STATUS_META[contract.status].tone" size="sm" dot>
            {{ CONTRACT_STATUS_META[contract.status].label }}
          </StatusTag>
        </div>
        <p class="mt-1 text-[11.5px] text-muted">
          {{ DEAL_TYPE_META[contract.dealType] }} · подписан {{ contract.signedAt ? fmtDate(contract.signedAt) : '—' }}
        </p>

        <!-- клиент -->
        <div class="mt-2.5 flex items-center gap-2.5 rounded-xl2 bg-soft px-2.5 py-2">
          <AppAvatar :name="client?.name ?? '—'" size="sm" :color="manager?.avatarColor" />
          <div class="min-w-0 flex-1">
            <p class="truncate text-[12.5px] font-semibold text-ink">{{ client?.name ?? 'Клиент' }}</p>
            <p class="truncate text-[11px] text-muted">
              {{ client?.phone ? fmtPhone(client.phone) : '—' }}<template v-if="manager"> · менеджер {{ manager.name }}</template>
            </p>
          </div>
          <a v-if="client?.phone" :href="`tel:+${client.phone}`" class="focus-ring grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line text-muted hover:text-ink" title="Позвонить">
            <Icon name="ph:phone" size="14" />
          </a>
        </div>

        <!-- деньги -->
        <dl class="mt-2.5">
          <div v-for="row in [
            ['Стоимость', money(basePrice, contract.currency)],
            ['Скидка', contract.discount ? `− ${money(basePrice - contract.price, contract.currency)} (${contract.discount}%)` : '—'],
            ['Цена договора', money(balance.price, contract.currency)],
            ['Оплачено', money(balance.paid, contract.currency)],
            ['Остаток', money(balance.remaining, contract.currency)],
          ]" :key="row[0]" class="flex items-baseline justify-between gap-3 border-b border-line py-1.5 last:border-0"
          >
            <dt class="text-[12px] text-muted">{{ row[0] }}</dt>
            <dd class="tabular text-[12.5px] font-semibold text-ink">{{ row[1] }}</dd>
          </div>
        </dl>

        <div class="mt-2">
          <div class="flex items-center justify-between text-[11.5px] text-muted">
            <span>Погашение · {{ paidCount }} из {{ schedule.length }} платежей</span>
            <span class="tabular font-semibold text-ink">{{ paidPct }}%</span>
          </div>
          <ProgressBar :percent="paidPct" tone="ok" :show-label="false" class="mt-1" />
        </div>

        <p v-if="balance.overdueAmount" class="mt-2.5 flex items-center gap-1.5 rounded-xl2 bg-bad-bg px-2.5 py-2 text-[12px] font-medium text-bad">
          <Icon name="ph:warning-circle" size="14" /> Просрочка {{ money(balance.overdueAmount) }} · {{ balance.overdueDays }} дн.
        </p>
        <p v-else-if="balance.nextDue" class="mt-2.5 flex items-center gap-1.5 rounded-xl2 bg-soft px-2.5 py-2 text-[12px] text-muted">
          <Icon name="ph:calendar-dot" size="14" />
          Следующий платёж {{ fmtDate(balance.nextDue.dueDate) }} —
          <b class="tabular text-ink">{{ money(balance.nextDue.amount - balance.nextDue.paid) }}</b>
        </p>
      </div>

      <!-- график -->
      <div class="rounded-card border border-line p-3">
        <button class="flex w-full items-center justify-between text-left" @click="showSchedule = !showSchedule">
          <span class="text-[12.5px] font-semibold text-ink">График платежей</span>
          <span class="flex items-center gap-1 text-[11.5px] text-muted">
            {{ showSchedule ? 'свернуть' : `ближайшие ${nextItems.length} из ${schedule.length}` }}
            <Icon :name="showSchedule ? 'ph:caret-up' : 'ph:caret-down'" size="12" />
          </span>
        </button>
        <table class="mt-2 w-full border-collapse text-[12px]">
          <tbody>
            <tr v-for="it in (showSchedule ? schedule : nextItems)" :key="it.id" class="border-b border-line last:border-0">
              <td class="py-1.5 text-muted">{{ fmtDate(it.dueDate) }}</td>
              <td class="tabular py-1.5 text-right font-semibold">{{ money(it.amount) }}</td>
              <td class="py-1.5 text-right">
                <StatusTag size="sm" :tone="it.paid >= it.amount ? 'ok' : new Date(it.dueDate) < new Date() ? 'bad' : 'neutral'">
                  {{ it.paid >= it.amount ? 'Оплачен' : new Date(it.dueDate) < new Date() ? 'Просрочен' : 'Ожидается' }}
                </StatusTag>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- платежи -->
      <div v-if="payments.length" class="rounded-card border border-line p-3">
        <p class="mb-2 text-[12.5px] font-semibold text-ink">Последние платежи</p>
        <div class="flex flex-col gap-1.5">
          <div v-for="p in payments.slice(0, 4)" :key="p.id" class="flex items-center gap-2 text-[12px]">
            <span class="text-muted">{{ fmtDateTime(p.date) }}</span>
            <span class="tabular ml-auto font-semibold">{{ money(p.amount, p.currency) }}</span>
            <StatusTag :tone="PAYMENT_STATUS_META[p.status].tone" size="sm">{{ PAYMENT_STATUS_META[p.status].label }}</StatusTag>
          </div>
        </div>
      </div>

      <AppButton variant="primary" icon="ph:file-text" block @click="navigateTo(`/contracts/${contract.id}`)">
        Открыть договор целиком
      </AppButton>
    </template>

    <!-- бронь -->
    <template v-else-if="reservation">
      <div class="rounded-card border border-reserve bg-reserve-bg p-3">
        <div class="flex items-center justify-between gap-2">
          <p class="text-[13px] font-semibold text-warn">{{ RESERVATION_KIND_META[reservation.kind].label }}</p>
          <StatusTag tone="warn" size="sm" dot>Бронь</StatusTag>
        </div>
        <CountdownBadge :until="reservation.expiresAt" :from="reservation.createdAt" class="mt-2" />
        <div class="mt-2.5 flex items-center gap-2.5">
          <AppAvatar :name="client?.name ?? '—'" size="sm" />
          <div class="min-w-0 flex-1">
            <p class="truncate text-[12.5px] font-semibold text-ink">{{ client?.name ?? 'Клиент' }}</p>
            <p class="truncate text-[11px] text-muted">{{ client?.phone ? fmtPhone(client.phone) : '' }}</p>
          </div>
          <a v-if="client?.phone" :href="`tel:+${client.phone}`" class="focus-ring grid h-8 w-8 place-items-center rounded-lg border border-line bg-panel text-muted hover:text-ink">
            <Icon name="ph:phone" size="14" />
          </a>
        </div>
        <p v-if="reservation.deposit" class="mt-2 text-[11.5px] text-muted">
          Задаток {{ money(reservation.deposit, 'KGS') }} · с {{ fmtDate(reservation.createdAt) }}
        </p>
      </div>
      <AppButton variant="primary" icon="ph:file-text" block @click="navigateTo(`/deals/new?unit=${unit.id}${lead ? `&lead=${lead.id}` : ''}`)">
        Оформить договор
      </AppButton>
    </template>

    <p v-else class="rounded-card border border-dashed border-line px-3 py-3 text-[12.5px] text-muted">
      По этому помещению нет ни брони, ни договора — сделка начнётся с брони.
    </p>
  </div>
</template>
