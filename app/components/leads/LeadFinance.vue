<script setup lang="ts">
import type { Lead, PaymentPlanKind } from '~/types/models'
import { calcForecast } from '~/utils/finance'
import { PAYMENT_PLANS, PAYMENT_PLAN_META } from '~/utils/meta'
import { fmtDate, money } from '~/utils/format'

// Пока договора нет — прогноз по тем же формулам, что и в мастере сделок.
// Иначе менеджер называет клиенту одну цифру, а договор печатает другую.
const props = defineProps<{ lead: Lead }>()

const salesStore = useSalesStore()
const unitsStore = useUnitsStore()
const dealsStore = useDealsStore()

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

const plan = ref<PaymentPlanKind>(props.lead.interest.paymentMethod ?? 'installment')
const discountPct = ref(0)
const downPct = ref(20)
const months = ref(24)
const showSchedule = ref(false)

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
</script>

<template>
  <AppCard id="sec-finance" :padded="false">
    <div class="flex items-center justify-between gap-3 px-4 pt-4">
      <h3 class="text-[13px] font-semibold uppercase tracking-[0.04em] text-muted">Финансы</h3>
      <StatusTag size="sm" :tone="contract ? 'ok' : 'neutral'">{{ contract ? 'По договору' : 'Прогноз' }}</StatusTag>
    </div>

    <div class="p-4">
      <!-- факт по договору -->
      <template v-if="contract && balance">
        <p class="text-[12px] text-muted">Договор <b class="text-ink">{{ contract.number }}</b> от {{ fmtDate(contract.createdAt) }}</p>
        <dl class="mt-2.5">
          <div v-for="row in [
            ['Стоимость договора', money(balance.price, contract.currency)],
            ['Оплачено', money(balance.paid, contract.currency)],
            ['Остаток', money(balance.remaining, contract.currency)],
          ]" :key="row[0]" class="flex items-baseline justify-between gap-3 border-b border-line py-1.5"
          >
            <dt class="text-[12px] text-muted">{{ row[0] }}</dt>
            <dd class="tabular text-[13px] font-semibold text-ink">{{ row[1] }}</dd>
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
        <p v-else-if="balance.nextDue" class="mt-2.5 text-[12px] text-muted">
          Ближайший платёж {{ fmtDate(balance.nextDue.dueDate) }} — <b class="tabular text-ink">{{ money(balance.nextDue.amount - balance.nextDue.paid) }}</b>
        </p>

        <button class="mt-2.5 flex items-center gap-1 text-[12px] font-medium text-muted hover:text-ink" @click="showSchedule = !showSchedule">
          <Icon :name="showSchedule ? 'ph:caret-up' : 'ph:caret-down'" size="12" /> График платежей · {{ schedule.length }}
        </button>
        <div v-if="showSchedule" class="mt-2 max-h-[240px] overflow-auto rounded-xl2 border border-line">
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

      <!-- прогноз -->
      <template v-else-if="unit">
        <p class="text-[12px] text-muted">Расчёт по № {{ unit.number }} · {{ money(unit.price) }}</p>

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
          <div v-for="row in [
            ['Стоимость', money(forecast.base)],
            ['Скидка', forecast.discount ? `− ${money(forecast.discount)}` : '—'],
            ['Итого', money(forecast.total)],
            ['Первый взнос', money(forecast.down)],
            ['Ежемесячно', forecast.monthly ? money(forecast.monthly) : '—'],
          ]" :key="row[0]" class="flex items-baseline justify-between gap-3 border-b border-line py-1.5"
            :class="row[0] === 'Итого' ? 'border-ink/20' : ''"
          >
            <dt class="text-[12px]" :class="row[0] === 'Итого' ? 'font-semibold text-ink' : 'text-muted'">{{ row[0] }}</dt>
            <dd class="tabular text-[13px] font-semibold" :class="row[0] === 'Скидка' && forecast.discount ? 'text-ok' : 'text-ink'">{{ row[1] }}</dd>
          </div>
        </dl>

        <button v-if="forecast.schedule.length > 1" class="mt-2.5 flex items-center gap-1 text-[12px] font-medium text-muted hover:text-ink" @click="showSchedule = !showSchedule">
          <Icon :name="showSchedule ? 'ph:caret-up' : 'ph:caret-down'" size="12" /> Предварительный график · {{ forecast.schedule.length }}
        </button>
        <div v-if="showSchedule" class="mt-2 max-h-[220px] overflow-auto rounded-xl2 border border-line">
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
</template>
