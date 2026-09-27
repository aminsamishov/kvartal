<script setup lang="ts">
import type { DiscountRequest } from '~/types/models'
import { APPROVAL_ROLE_META, approvalRoleOf } from '~/stores/approvals'
import { fmtDateTime, money } from '~/utils/format'

definePageMeta({ breadcrumb: [{ label: 'Продажи' }, { label: 'Согласования' }] })

/**
 * Согласование скидок для руководителя: всё, что ждёт решения, в одном месте.
 * Пока этого экрана не было, запросы жили в карточках заявок — и находились
 * только тогда, когда менеджер напоминал о себе в мессенджере.
 */
const approvals = useApprovalsStore()
const salesStore = useSalesStore()
const unitsStore = useUnitsStore()
const settingsStore = useSettingsStore()
const misc = useMiscStore()
const auth = useAuthStore()
const ui = useUiStore()

const myRole = computed(() => approvalRoleOf(auth.user?.role))
const filter = ref<'mine' | 'pending' | 'all'>(myRole.value ? 'mine' : 'pending')

const rows = computed(() => {
  const list = filter.value === 'mine'
    ? approvals.pendingForRole(myRole.value)
    : filter.value === 'pending'
      ? approvals.pending
      : approvals.requests
  return [...list]
    .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))
    .map((r) => ({
      request: r,
      client: salesStore.client(r.clientId),
      unit: r.unitId ? unitsStore.unit(r.unitId) : undefined,
      lead: r.leadId ? salesStore.lead(r.leadId) : undefined,
      step: approvals.currentStep(r),
    }))
})

const decidingId = ref<string | null>(null)
const comment = ref('')

function canDecide(r: DiscountRequest) {
  const step = approvals.currentStep(r)
  return Boolean(step && myRole.value && step.role === myRole.value)
}

async function decide(r: DiscountRequest, decision: 'approved' | 'rejected') {
  await approvals.decide(r.id, decision, auth.user?.name ?? 'Система', comment.value)
  misc.log('Согласования', `Скидка ${r.percent}%: ${decision === 'approved' ? 'согласована' : 'отклонена'}`, auth.user?.name ?? '')
  if (r.leadId && decision === 'approved') {
    misc.notify({
      key: `approval-done-${r.id}`,
      text: `Скидка ${r.percent}% согласована — можно оформлять договор`,
      kind: 'approval',
    })
  }
  ui.toast(decision === 'approved' ? 'Согласовано' : 'Отклонено', decision === 'approved' ? 'ok' : 'info')
  decidingId.value = null
  comment.value = ''
}

const STATUS_META = {
  pending: { label: 'На согласовании', tone: 'warn' as const },
  approved: { label: 'Согласована', tone: 'ok' as const },
  rejected: { label: 'Отклонена', tone: 'bad' as const },
}

const limits = computed(() => settingsStore.discountLimits)
const pendingSum = computed(() => approvals.pending.reduce((s, r) => s + r.amount, 0))
</script>

<template>
  <div class="flex flex-col gap-4">
    <PageHeader
      title="Согласование скидок"
      :subtitle="`${approvals.pending.length} запросов ждут решения на ${money(pendingSum)}`"
    >
      <template #actions>
        <SegmentedControl
          :model-value="filter"
          :options="[
            { value: 'mine', label: 'Ждут меня', icon: 'ph:gavel' },
            { value: 'pending', label: 'Все открытые', icon: 'ph:clock' },
            { value: 'all', label: 'История', icon: 'ph:archive' },
          ]"
          @update:model-value="filter = $event as typeof filter"
        />
      </template>
    </PageHeader>

    <p class="flex items-center gap-2 rounded-card border border-line bg-soft px-3.5 py-2.5 text-[12.5px] text-muted">
      <Icon name="ph:info" size="15" class="shrink-0" />
      Маршрут зависит от размера скидки: до {{ limits.manager }}% — решает менеджер,
      до {{ limits.head }}% — руководитель, выше — директор.
      Лимиты меняются в настройках сделок.
    </p>

    <div v-if="rows.length" class="flex flex-col gap-3">
      <AppCard v-for="row in rows" :key="row.request.id" :padded="false">
        <div class="flex flex-wrap items-start gap-4 p-4">
          <!-- величина -->
          <div class="shrink-0">
            <p class="tabular text-[24px] font-semibold leading-none tracking-[-0.03em] text-ink">−{{ row.request.percent }}%</p>
            <p class="tabular mt-1 text-[12px] text-muted">{{ money(row.request.amount) }}</p>
          </div>

          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <p class="text-[14px] font-semibold text-ink">{{ row.client?.name ?? 'Клиент' }}</p>
              <span v-if="row.unit" class="tabular text-[12.5px] text-muted">
                № {{ row.unit.number }} · {{ money(row.request.basePrice) }} → {{ money(row.request.basePrice - row.request.amount) }}
              </span>
              <StatusTag :tone="STATUS_META[row.request.status].tone" size="sm" dot>{{ STATUS_META[row.request.status].label }}</StatusTag>
            </div>
            <p v-if="row.request.reason" class="mt-1 text-[12.5px] text-muted">«{{ row.request.reason }}»</p>
            <p class="mt-1 text-[11.5px] text-muted">
              Запросил {{ row.request.requestedBy }} · {{ fmtDateTime(row.request.requestedAt) }}
              <template v-if="row.step"> · ждёт: {{ APPROVAL_ROLE_META[row.step.role].label }}</template>
            </p>

            <!-- маршрут -->
            <ol class="mt-2.5 flex flex-wrap items-center gap-x-1.5 gap-y-1">
              <li v-for="(step, i) in row.request.steps" :key="i" class="flex items-center gap-1.5">
                <span
                  class="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-medium"
                  :class="step.decision === 'approved' ? 'bg-ok-bg text-ok' : step.decision === 'rejected' ? 'bg-bad-bg text-bad' : 'bg-soft text-muted'"
                  :title="step.comment"
                >
                  <Icon
                    :name="step.decision === 'approved' ? 'ph:check-bold' : step.decision === 'rejected' ? 'ph:x-bold' : 'ph:clock'"
                    size="10"
                  />
                  {{ APPROVAL_ROLE_META[step.role].label }}
                  <span v-if="step.decidedBy" class="font-normal opacity-80">· {{ step.decidedBy }}</span>
                </span>
                <Icon v-if="i < row.request.steps.length - 1" name="ph:caret-right" size="10" class="text-muted" />
              </li>
            </ol>
          </div>

          <!-- действия -->
          <div class="flex shrink-0 flex-col items-end gap-2">
            <AppButton v-if="row.lead" size="sm" icon="ph:arrow-square-out" @click="navigateTo('/leads')">К заявке</AppButton>
            <template v-if="canDecide(row.request)">
              <AppButton v-if="decidingId !== row.request.id" size="sm" variant="primary" icon="ph:gavel" @click="decidingId = row.request.id">
                Принять решение
              </AppButton>
              <div v-else class="w-[280px] rounded-xl2 border border-line bg-soft p-2.5">
                <AppInput v-model="comment" placeholder="Комментарий к решению" />
                <div class="mt-2 flex gap-2">
                  <AppButton size="sm" block variant="danger" icon="ph:x" @click="decide(row.request, 'rejected')">Отклонить</AppButton>
                  <AppButton size="sm" block variant="primary" icon="ph:check-bold" @click="decide(row.request, 'approved')">Согласовать</AppButton>
                </div>
              </div>
            </template>
            <p v-else-if="row.request.status === 'pending'" class="text-[11.5px] text-muted">
              Решение за: {{ row.step ? APPROVAL_ROLE_META[row.step.role].label : '—' }}
            </p>
          </div>
        </div>
      </AppCard>
    </div>

    <EmptyState
      v-else icon="ph:percent"
      :title="filter === 'mine' ? 'Вас ничего не ждёт' : filter === 'pending' ? 'Открытых запросов нет' : 'Запросов не было'"
      text="Скидки в пределах полномочий менеджера проходят без согласования — здесь остаётся только то, что выше лимита"
    />
  </div>
</template>
