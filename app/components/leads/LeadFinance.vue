<script setup lang="ts">
import type { Lead, PaymentPlanKind } from '~/types/models'
import { calcForecast } from '~/utils/finance'
import { PAYMENT_PLANS, PAYMENT_PLAN_META } from '~/utils/meta'
import { fmtDate, money } from '~/utils/format'

/**
 * Финансы заявки в двух режимах. «Прогноз» считает по тем же формулам, что
 * мастер сделок, «Факт» читает договор и график: иначе менеджер называет
 * клиенту одну цифру, а договор печатает другую.
 */
const props = defineProps<{ lead: Lead }>()

const salesStore = useSalesStore()
const unitsStore = useUnitsStore()
const dealsStore = useDealsStore()
const approvals = useApprovalsStore()

const contract = computed(() => dealsStore.contractsForLead(props.lead.id)[0])
const balance = computed(() => (contract.value ? dealsStore.balance(contract.value.id) : null))
const schedule = computed(() => (contract.value ? dealsStore.scheduleFor(contract.value.id) : []))

// объект расчёта: из договора, из брони, иначе первый интересующий
const unit = computed(() => {
  if (contract.value) return unitsStore.unit(contract.value.unitIds[0] ?? '')
  const res = salesStore.activeReservationForLead(props.lead.id)
  if (res) return unitsStore.unit(res.unitId)
  return unitsStore.unit(props.lead.interestedUnitIds[0] ?? '')
})

const mode = ref<'forecast' | 'fact'>(contract.value ? 'fact' : 'forecast')
watch(contract, (c) => { mode.value = c ? 'fact' : 'forecast' })

const plan = ref<PaymentPlanKind>(props.lead.interest.paymentMethod ?? 'installment')
// согласованную скидку подставляем сразу: пересчитывать её руками — источник
// расхождений между обещанием клиенту и договором
const discountPct = ref(approvals.approvedPercentForLead(props.lead.id))
const downPct = ref(20)
const months = ref(24)
const showSchedule = ref(false)

watch(() => approvals.approvedPercentForLead(props.lead.id), (pct) => {
  if (pct && !discountPct.value) discountPct.value = pct
})

const forecast = computed(() => calcForecast({
  price: unit.value?.price ?? 0,
  discountPct: discountPct.value,
  downPct: downPct.value,
  months: months.value,
  plan: plan.value,
}))

const paidPct = computed(() => (balance.value && balance.value.price
  ? Math.round((balance.value.paid / balance.value.price) * 100)
  : 0))

const forecastRows = computed(() => [
  { label: 'Стоимость', value: money(forecast.value.base) },
  { label: 'Скидка', value: forecast.value.discount ? `− ${money(forecast.value.discount)}` : '—', tone: forecast.value.discount ? 'ok' : undefined },
  { label: 'Цена после скидки', value: money(forecast.value.total), strong: true },
  { label: 'Первый взнос', value: money(forecast.value.down) },
  { label: 'Остаток к рассрочке', value: money(forecast.value.rest) },
  { label: 'Ежемесячно', value: forecast.value.monthly ? money(forecast.value.monthly) : '—' },
] as { label: string; value: string; tone?: string; strong?: boolean }[])

const factRows = computed(() => {
  const b = balance.value
  const c = contract.value
  if (!b || !c) return []
  const base = c.discount ? Math.round(c.price / (1 - c.discount / 100)) : c.price
  return [
    { label: 'Стоимость', value: money(base, c.currency) },
    { label: 'Скидка', value: c.discount ? `− ${money(base - c.price, c.currency)} (${c.discount}%)` : '—', tone: c.discount ? 'ok' : undefined },
    { label: 'Цена после скидки', value: money(b.price, c.currency), strong: true },
    { label: 'Первый взнос по графику', value: schedule.value[0] ? money(schedule.value[0].amount, c.currency) : '—' },
    { label: 'Оплачено', value: money(b.paid, c.currency) },
    { label: 'Остаток', value: money(b.remaining, c.currency) },
  ] as { label: string; value: string; tone?: string; strong?: boolean }[]
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <AppCard :padded="false">
      <div class="flex flex-wrap items-center justify-between gap-2 px-4 pt-4">
        <h3 class="text-[13px] font-semibold uppercase tracking-[0.04em] text-muted">Финансы</h3>
        <SegmentedControl
          :model-value="mode"
          :options="[
            { value: 'forecast', label: 'Прогноз', icon: 'ph:calculator' },
            { value: 'fact', label: 'Факт', icon: 'ph:receipt' },
          ]"
          @update:model-value="mode = $event as 'forecast' | 'fact'"
        />
      </div>

      <div class="p-4">
        <!-- ФАКТ -->
        <template v-if="mode === 'fact'">
          <template v-if="contract && balance">
            <div class="flex flex-wrap items-center gap-2">
              <p class="text-[12px] text-muted">
                Договор <NuxtLink :to="`/contracts/${contract.id}`" class="font-semibold text-plum hover:underline">{{ contract.number }}</NuxtLink>
                от {{ fmtDate(contract.createdAt) }}
              </p>
              <StatusTag :tone="contract.status === 'active' ? 'info' : contract.status === 'paid' ? 'ok' : 'warn'" size="sm" class="ml-auto">
                {{ contract.status === 'active' ? 'Активен' : contract.status === 'paid' ? 'Оплачен' : 'На согласовании' }}
              </StatusTag>
            </div>

            <dl class="mt-2.5">
              <div
                v-for="row in factRows" :key="row.label"
                class="flex items-baseline justify-between gap-3 border-b py-1.5"
                :class="row.strong ? 'border-ink/20' : 'border-line'"
              >
                <dt class="text-[12px]" :class="row.strong ? 'font-semibold text-ink' : 'text-muted'">{{ row.label }}</dt>
                <dd class="tabular text-[13px] font-semibold" :class="row.tone === 'ok' ? 'text-ok' : 'text-ink'">{{ row.value }}</dd>
              </div>
            </dl>

            <div class="mt-2.5">
              <div class="flex items-center justify-between text-[11.5px] text-muted">
                <span>Погашение</span><span class="tabular font-semibold text-ink">{{ paidPct }}%</span>
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

            <button class="mt-2.5 flex items-center gap-1 text-[12px] font-medium text-muted hover:text-ink" @click="showSchedule = !showSchedule">
              <Icon :name="showSchedule ? 'ph:caret-up' : 'ph:caret-down'" size="12" /> График платежей · {{ schedule.length }}
            </button>
            <div v-if="showSchedule" class="mt-2 max-h-[260px] overflow-auto rounded-xl2 border border-line">
              <table class="w-full border-collapse text-[12px]">
                <tbody>
                  <tr v-for="(it, i) in schedule" :key="it.id" class="border-b border-line last:border-0">
                    <td class="px-2.5 py-1.5 text-muted">{{ i + 1 }}. {{ fmtDate(it.dueDate) }}</td>
                    <td class="tabular px-2.5 py-1.5 text-right font-semibold">{{ money(it.amount) }}</td>
                    <td class="px-2.5 py-1.5 text-right">
                      <StatusTag size="sm" :tone="it.paid >= it.amount ? 'ok' : new Date(it.dueDate) < new Date() ? 'bad' : 'neutral'">
                        {{ it.paid >= it.amount ? 'Оплачен' : new Date(it.dueDate) < new Date() ? 'Просрочен' : 'Ожидается' }}
                      </StatusTag>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>

          <div v-else class="flex flex-col items-start gap-2 rounded-xl2 border border-dashed border-line px-3 py-3">
            <p class="flex items-center gap-2 text-[12.5px] text-muted">
              <Icon name="ph:receipt" size="15" /> Договора пока нет — факта тоже. Посмотрите прогноз или оформите сделку.
            </p>
            <AppButton size="sm" icon="ph:calculator" @click="mode = 'forecast'">К прогнозу</AppButton>
          </div>
        </template>

        <!-- ПРОГНОЗ -->
        <template v-else-if="unit">
          <p class="text-[12px] text-muted">
            Расчёт по № {{ unit.number }} · {{ money(unit.price) }}
            <span class="text-muted">· {{ unitsStore.building(unit.buildingId)?.name }}</span>
          </p>

          <div class="mt-2.5 flex flex-wrap gap-1.5">
            <Chip v-for="pm in PAYMENT_PLANS" :key="pm" :pressed="plan === pm" :icon="PAYMENT_PLAN_META[pm].icon" @click="plan = pm">
              {{ PAYMENT_PLAN_META[pm].label }}
            </Chip>
          </div>

          <div class="mt-3 grid grid-cols-3 gap-2">
            <AppInput v-model.number="discountPct" type="number" label="Скидка, %" />
            <AppInput v-model.number="downPct" type="number" label="Взнос, %" :disabled="plan === 'full'" />
            <AppInput v-model.number="months" type="number" label="Месяцев" :disabled="plan === 'full'" />
          </div>

          <dl class="mt-3">
            <div
              v-for="row in forecastRows" :key="row.label"
              class="flex items-baseline justify-between gap-3 border-b py-1.5"
              :class="row.strong ? 'border-ink/20' : 'border-line'"
            >
              <dt class="text-[12px]" :class="row.strong ? 'font-semibold text-ink' : 'text-muted'">{{ row.label }}</dt>
              <dd class="tabular text-[13px] font-semibold" :class="row.tone === 'ok' ? 'text-ok' : 'text-ink'">{{ row.value }}</dd>
            </div>
          </dl>

          <button v-if="forecast.schedule.length > 1" class="mt-2.5 flex items-center gap-1 text-[12px] font-medium text-muted hover:text-ink" @click="showSchedule = !showSchedule">
            <Icon :name="showSchedule ? 'ph:caret-up' : 'ph:caret-down'" size="12" /> Предварительный график · {{ forecast.schedule.length }}
          </button>
          <div v-if="showSchedule" class="mt-2 max-h-[240px] overflow-auto rounded-xl2 border border-line">
            <table class="w-full border-collapse text-[12px]">
              <tbody>
                <tr v-for="row in forecast.schedule" :key="row.index" class="border-b border-line last:border-0">
                  <td class="px-2.5 py-1.5 text-muted">{{ row.isDown ? 'Первый взнос' : `${row.index}. ${fmtDate(row.dueAt)}` }}</td>
                  <td class="tabular px-2.5 py-1.5 text-right font-semibold">{{ money(row.amount) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>

        <p v-else class="flex items-center gap-2 rounded-xl2 border border-dashed border-line px-3 py-2.5 text-[12.5px] text-muted">
          <Icon name="ph:calculator" size="15" /> Выберите квартиру — покажем расчёт
        </p>
      </div>
    </AppCard>

    <DiscountApproval
      :lead-id="lead.id" :client-id="lead.clientId"
      :base-price="unit?.price ?? 0" :unit-id="unit?.id" :contract-id="contract?.id"
    />
  </div>
</template>
