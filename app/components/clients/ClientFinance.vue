<script setup lang="ts">
import type { PaymentKind } from '~/types/models'
import type { ClientProfile, ScheduleRowView } from '~/utils/clientProfile'
import { PAYMENT_KIND_META, PAYMENT_STATUS_META } from '~/utils/meta'
import { fmtDate, fmtDateTime, money } from '~/utils/format'

/**
 * Финансы клиента как банковский кабинет: сверху состояние счёта, ниже —
 * график с планом, фактом и остатком по каждой строке. Менеджер отвечает на
 * «сколько и когда» не листая договоры.
 */
const props = defineProps<{ profile: ClientProfile }>()

const dealsStore = useDealsStore()
const misc = useMiscStore()
const auth = useAuthStore()
const ui = useUiStore()

const t = computed(() => props.profile.totals)

const STATE_META: Record<ScheduleRowView['state'], { label: string; tone: 'ok' | 'warn' | 'bad' | 'neutral' }> = {
  paid: { label: 'Оплачено', tone: 'ok' },
  today: { label: 'Сегодня', tone: 'warn' },
  overdue: { label: 'Просрочено', tone: 'bad' },
  future: { label: 'Будущий', tone: 'neutral' },
}

const filter = ref<'' | ScheduleRowView['state']>('')
const rows = computed(() => (filter.value
  ? props.profile.schedule.filter((r) => r.state === filter.value)
  : props.profile.schedule))

const counts = computed(() => {
  const map = { paid: 0, today: 0, overdue: 0, future: 0 } as Record<ScheduleRowView['state'], number>
  for (const r of props.profile.schedule) map[r.state]++
  return map
})

/* ------------------------------ добавить оплату --------------------------- */

const payOpen = ref(false)
const form = reactive({ contractId: '', amount: 0, kind: 'bank' as PaymentKind })

watchEffect(() => {
  if (!form.contractId && props.profile.contracts[0]) form.contractId = props.profile.contracts[0].id
})

function openPay(row?: ScheduleRowView) {
  if (!props.profile.contracts.length) { ui.toast('У клиента нет договора — оплату регистрировать не к чему', 'warn'); return }
  form.contractId = row?.contractId ?? props.profile.contracts[0]!.id
  form.amount = row?.remaining ?? t.value.nextDue?.remaining ?? 0
  payOpen.value = true
}

async function submitPay() {
  if (!form.contractId || form.amount <= 0) { ui.toast('Укажите сумму', 'warn'); return }
  await dealsStore.registerPayment(form.contractId, form.amount, form.kind)
  const contract = dealsStore.contract(form.contractId)
  misc.log('Платежи', `Платёж ${money(form.amount)} по договору ${contract?.number ?? ''} от ${props.profile.client.name}`, auth.user?.name ?? '')
  ui.toast('Платёж зарегистрирован, ждёт подтверждения бухгалтера', 'info')
  payOpen.value = false
}

defineExpose({ openPay })
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- состояние счёта -->
    <div class="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line lg:grid-cols-5">
      <div class="bg-panel px-4 py-3">
        <p class="text-[11px] uppercase tracking-[0.04em] text-muted">Общая стоимость</p>
        <p class="tabular mt-1 text-[19px] font-semibold tracking-[-0.02em] text-ink">{{ money(t.purchases) }}</p>
      </div>
      <div class="bg-panel px-4 py-3">
        <p class="text-[11px] uppercase tracking-[0.04em] text-muted">Оплачено</p>
        <p class="tabular mt-1 text-[19px] font-semibold tracking-[-0.02em] text-ok">{{ money(t.paid) }}</p>
        <ProgressBar :percent="t.paidPct" tone="ok" :show-label="false" class="mt-1.5" />
      </div>
      <div class="bg-panel px-4 py-3">
        <p class="text-[11px] uppercase tracking-[0.04em] text-muted">Остаток</p>
        <p class="tabular mt-1 text-[19px] font-semibold tracking-[-0.02em] text-ink">{{ t.remaining ? money(t.remaining) : '—' }}</p>
      </div>
      <div class="bg-panel px-4 py-3">
        <p class="text-[11px] uppercase tracking-[0.04em] text-muted">Просрочено</p>
        <p class="tabular mt-1 text-[19px] font-semibold tracking-[-0.02em]" :class="t.overdueAmount ? 'text-bad' : 'text-muted'">
          {{ t.overdueAmount ? money(t.overdueAmount) : '—' }}
        </p>
        <p v-if="t.overdueDays" class="text-[11px] text-bad">{{ t.overdueDays }} дн. максимум</p>
      </div>
      <div class="bg-panel px-4 py-3">
        <p class="text-[11px] uppercase tracking-[0.04em] text-muted">Следующий платёж</p>
        <p class="tabular mt-1 text-[19px] font-semibold tracking-[-0.02em] text-ink">
          {{ t.nextDue ? money(t.nextDue.remaining) : '—' }}
        </p>
        <p v-if="t.nextDue" class="text-[11px] text-muted">{{ fmtDate(t.nextDue.dueDate) }}</p>
      </div>
    </div>

    <!-- график -->
    <AppCard :padded="false">
      <div class="flex flex-wrap items-center justify-between gap-2 px-4 pt-4">
        <h3 class="text-[13px] font-semibold uppercase tracking-[0.04em] text-muted">
          График платежей
          <span class="tabular ml-1 rounded-full bg-soft px-1.5 py-0.5 text-[11px] text-ink">{{ profile.schedule.length }}</span>
        </h3>
        <div class="flex flex-wrap items-center gap-1.5">
          <button
            v-for="(meta, state) in STATE_META" :key="state" type="button"
            class="focus-ring rounded-lg px-2 py-1 text-[11.5px] font-medium transition-colors"
            :class="filter === state ? 'bg-ink text-panel' : 'text-muted hover:text-ink'"
            @click="filter = filter === state ? '' : state"
          >
            {{ meta.label }} <b class="tabular">{{ counts[state] }}</b>
          </button>
          <AppButton size="sm" variant="primary" icon="ph:plus-bold" class="ml-1" @click="openPay()">Добавить оплату</AppButton>
        </div>
      </div>

      <div class="mt-3 overflow-x-auto">
        <table class="data-table">
          <thead>
            <tr>
              <th>Дата</th>
              <th>Договор</th>
              <th class="text-right">План</th>
              <th class="text-right">Факт</th>
              <th class="text-right">Остаток</th>
              <th>Статус</th>
              <th class="w-10" />
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in rows" :key="r.id">
              <td class="tabular">{{ fmtDate(r.dueDate) }}</td>
              <td class="tabular text-muted">{{ r.contractNumber }}</td>
              <td class="tabular text-right">{{ money(r.plan) }}</td>
              <td class="tabular text-right" :class="r.fact ? 'text-ok' : 'text-muted'">{{ r.fact ? money(r.fact) : '—' }}</td>
              <td class="tabular text-right font-semibold">{{ r.remaining ? money(r.remaining) : '—' }}</td>
              <td><StatusTag :tone="STATE_META[r.state].tone" size="sm" dot>{{ STATE_META[r.state].label }}</StatusTag></td>
              <td>
                <button
                  v-if="r.state !== 'paid'" class="focus-ring grid h-7 w-7 place-items-center rounded-lg text-muted hover:text-plum"
                  title="Зарегистрировать оплату по этой строке" @click.stop="openPay(r)"
                ><Icon name="ph:plus-circle" size="15" /></button>
              </td>
            </tr>
          </tbody>
        </table>
        <EmptyState v-if="!rows.length" compact icon="ph:calendar-check" :title="profile.schedule.length ? 'В этой группе пусто' : 'Графика нет'" />
      </div>
    </AppCard>

    <!-- платежи -->
    <AppCard v-if="profile.payments.length" :padded="false">
      <div class="px-4 pt-4">
        <h3 class="text-[13px] font-semibold uppercase tracking-[0.04em] text-muted">Поступления</h3>
      </div>
      <div class="mt-3 overflow-x-auto">
        <table class="data-table">
          <thead><tr><th>Дата</th><th>Договор</th><th class="text-right">Сумма</th><th>Способ</th><th>Статус</th><th>Чек</th></tr></thead>
          <tbody>
            <tr v-for="p in profile.payments.slice(0, 12)" :key="p.id">
              <td class="tabular">{{ fmtDateTime(p.date) }}</td>
              <td class="tabular text-muted">{{ profile.contracts.find((c) => c.id === p.contractId)?.number ?? '—' }}</td>
              <td class="tabular text-right font-semibold">{{ money(p.amount, p.currency) }}</td>
              <td>{{ PAYMENT_KIND_META[p.kind] }}</td>
              <td><StatusTag :tone="PAYMENT_STATUS_META[p.status].tone" size="sm">{{ PAYMENT_STATUS_META[p.status].label }}</StatusTag></td>
              <td class="tabular text-muted">{{ p.receiptNumber ?? '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </AppCard>

    <!-- регистрация оплаты -->
    <AppModal v-model="payOpen" title="Добавить оплату" width="sm">
      <div class="flex flex-col gap-3.5">
        <AppSelect
          v-model="form.contractId" label="Договор"
          :options="profile.contracts.map((c) => ({ value: c.id, label: `${c.number} · ${money(c.price, c.currency)}` }))"
        />
        <AppInput v-model.number="form.amount" type="number" label="Сумма, $" />
        <AppSelect
          v-model="form.kind" label="Способ"
          :options="Object.entries(PAYMENT_KIND_META).map(([value, label]) => ({ value, label }))"
        />
        <p class="rounded-xl2 bg-soft px-3 py-2 text-[11.5px] text-muted">
          Платёж уйдёт на подтверждение бухгалтеру — в график он попадёт после подтверждения.
        </p>
        <div class="flex gap-2">
          <AppButton block @click="payOpen = false">Отмена</AppButton>
          <AppButton block variant="primary" icon="ph:check-bold" @click="submitPay">Зарегистрировать</AppButton>
        </div>
      </div>
    </AppModal>
  </div>
</template>
