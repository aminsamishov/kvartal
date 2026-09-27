<script setup lang="ts">
import type { DiscountRequest } from '~/types/models'
import { APPROVAL_ROLE_META, approvalRoleOf } from '~/stores/approvals'
import { fmtDateTime, money } from '~/utils/format'

/**
 * Согласование скидки: Менеджер → Руководитель → Директор, с историей решений.
 * Скидка в пределах полномочий менеджера проходит сразу — маршрут включается
 * только там, где он действительно нужен.
 */
const props = defineProps<{
  leadId: string
  clientId: string
  basePrice: number
  unitId?: string
  contractId?: string
}>()

const approvals = useApprovalsStore()
const settings = useSettingsStore()
const misc = useMiscStore()
const auth = useAuthStore()
const ui = useUiStore()

const requests = computed(() => approvals.forLead(props.leadId))
const myRole = computed(() => approvalRoleOf(auth.user?.role))
const limits = computed(() => settings.discountLimits)

const form = reactive({ percent: 5, reason: '' })
const composing = ref(false)
const decidingId = ref<string | null>(null)
const decisionComment = ref('')

const route = computed(() => approvals.routeFor(form.percent))
const amount = computed(() => Math.round(props.basePrice * (form.percent / 100)))
const finalPrice = computed(() => props.basePrice - amount.value)

function canDecide(request: DiscountRequest) {
  const step = approvals.currentStep(request)
  return Boolean(step && myRole.value && step.role === myRole.value)
}

async function submit() {
  if (!props.basePrice) { ui.toast('Сначала выберите квартиру — скидка считается от её цены', 'warn'); return }
  if (form.percent <= 0) { ui.toast('Укажите размер скидки', 'warn'); return }
  const request = await approvals.request({
    leadId: props.leadId,
    clientId: props.clientId,
    unitId: props.unitId,
    contractId: props.contractId,
    basePrice: props.basePrice,
    percent: form.percent,
    reason: form.reason,
    requestedBy: auth.user?.name ?? 'Менеджер',
    requestedById: auth.user?.id ?? '',
  })
  misc.log('Согласования', `Запрошена скидка ${form.percent}% (${money(request.amount)})`, auth.user?.name ?? '')
  if (request.status === 'approved') {
    ui.toast(`Скидка ${form.percent}% в пределах ваших полномочий — согласование не требуется`, 'ok')
  } else {
    misc.notify({
      key: `approval-${request.id}`,
      text: `Скидка ${form.percent}% ждёт решения: ${APPROVAL_ROLE_META[approvals.currentStep(request)!.role].label}`,
      kind: 'approval',
    })
    ui.toast('Запрос отправлен на согласование', 'ok')
  }
  composing.value = false
  form.reason = ''
}

async function decide(request: DiscountRequest, decision: 'approved' | 'rejected') {
  await approvals.decide(request.id, decision, auth.user?.name ?? 'Система', decisionComment.value)
  misc.log('Согласования', `Скидка ${request.percent}%: ${decision === 'approved' ? 'согласована' : 'отклонена'}`, auth.user?.name ?? '')
  ui.toast(decision === 'approved' ? 'Решение сохранено' : 'Запрос отклонён', decision === 'approved' ? 'ok' : 'info')
  decidingId.value = null
  decisionComment.value = ''
}

const STATUS_META = {
  pending: { label: 'На согласовании', tone: 'warn' as const },
  approved: { label: 'Согласована', tone: 'ok' as const },
  rejected: { label: 'Отклонена', tone: 'bad' as const },
}
</script>

<template>
  <AppCard :padded="false">
    <div class="flex flex-wrap items-center justify-between gap-2 px-4 pt-4">
      <h3 class="text-[13px] font-semibold uppercase tracking-[0.04em] text-muted">Согласование скидки</h3>
      <AppButton size="sm" :icon="composing ? 'ph:x' : 'ph:percent'" @click="composing = !composing">
        {{ composing ? 'Отмена' : 'Запросить' }}
      </AppButton>
    </div>

    <div class="p-4">
      <!-- запрос -->
      <div v-if="composing" class="mb-3 flex flex-col gap-3 rounded-xl2 border border-plum bg-plum-soft/40 p-3">
        <div class="grid grid-cols-2 gap-3">
          <AppInput v-model.number="form.percent" type="number" label="Скидка, %" suffix="%" />
          <div class="flex flex-col justify-end pb-2 text-[12px]">
            <p class="text-muted">Сумма скидки <b class="tabular text-ink">{{ money(amount) }}</b></p>
            <p class="text-muted">К оплате <b class="tabular text-ink">{{ money(finalPrice) }}</b></p>
          </div>
        </div>

        <label class="flex flex-col gap-1.5 text-[12.5px] font-medium text-muted">
          Обоснование
          <textarea
            v-model="form.reason" rows="2" placeholder="Почему компании выгодно дать эту скидку"
            class="focus-ring resize-y rounded-xl2 border border-line bg-panel px-3 py-2 text-[13px] font-normal text-ink placeholder:text-muted/70"
          />
        </label>

        <p class="flex items-start gap-1.5 rounded-lg bg-panel px-2.5 py-2 text-[11.5px] text-muted">
          <Icon name="ph:info" size="13" class="mt-0.5 shrink-0" />
          <span v-if="!route.length">До {{ limits.manager }}% менеджер согласовывает сам — скидка применится сразу.</span>
          <span v-else>
            Маршрут: {{ ['Менеджер', ...route.map((r) => APPROVAL_ROLE_META[r].label)].join(' → ') }}.
            До {{ limits.manager }}% — без согласования, до {{ limits.head }}% — руководитель, выше — директор.
          </span>
        </p>

        <div class="flex gap-2">
          <AppButton block @click="composing = false">Отмена</AppButton>
          <AppButton block variant="primary" icon="ph:paper-plane-right" @click="submit">
            {{ route.length ? 'Отправить на согласование' : 'Применить скидку' }}
          </AppButton>
        </div>
      </div>

      <!-- история -->
      <div v-if="requests.length" class="flex flex-col gap-2.5">
        <article v-for="r in requests" :key="r.id" class="rounded-xl2 border border-line p-3">
          <div class="flex flex-wrap items-center gap-2">
            <p class="tabular text-[15px] font-semibold text-ink">−{{ r.percent }}%</p>
            <p class="tabular text-[12.5px] text-muted">{{ money(r.amount) }} · к оплате {{ money(r.basePrice - r.amount) }}</p>
            <StatusTag :tone="STATUS_META[r.status].tone" size="sm" dot class="ml-auto">{{ STATUS_META[r.status].label }}</StatusTag>
          </div>
          <p v-if="r.reason" class="mt-1 text-[12px] text-muted">«{{ r.reason }}»</p>

          <!-- маршрут решений -->
          <ol class="mt-2.5 flex flex-col gap-1.5">
            <li v-for="(step, i) in r.steps" :key="i" class="flex items-start gap-2">
              <span
                class="mt-px grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full"
                :class="step.decision === 'approved' ? 'bg-ok-bg text-ok' : step.decision === 'rejected' ? 'bg-bad-bg text-bad' : 'bg-soft text-muted'"
              >
                <Icon
                  :name="step.decision === 'approved' ? 'ph:check-bold' : step.decision === 'rejected' ? 'ph:x-bold' : 'ph:clock'"
                  size="10"
                />
              </span>
              <div class="min-w-0 flex-1">
                <p class="text-[12px] font-medium text-ink">
                  {{ APPROVAL_ROLE_META[step.role].label }}
                  <span v-if="step.decidedBy" class="font-normal text-muted">· {{ step.decidedBy }}</span>
                </p>
                <p v-if="step.decidedAt" class="text-[11px] text-muted">
                  {{ fmtDateTime(step.decidedAt) }}<template v-if="step.comment"> — {{ step.comment }}</template>
                </p>
                <p v-else class="text-[11px] text-muted">ожидает решения</p>
              </div>
            </li>
          </ol>

          <!-- решение -->
          <template v-if="canDecide(r)">
            <div v-if="decidingId === r.id" class="mt-2.5 rounded-lg border border-line bg-soft p-2.5">
              <AppInput v-model="decisionComment" placeholder="Комментарий к решению" />
              <div class="mt-2 flex gap-2">
                <AppButton size="sm" block variant="danger" icon="ph:x" @click="decide(r, 'rejected')">Отклонить</AppButton>
                <AppButton size="sm" block variant="primary" icon="ph:check-bold" @click="decide(r, 'approved')">Согласовать</AppButton>
              </div>
            </div>
            <AppButton v-else size="sm" variant="primary" icon="ph:gavel" class="mt-2.5" @click="decidingId = r.id">
              Принять решение
            </AppButton>
          </template>
        </article>
      </div>

      <p v-else-if="!composing" class="flex items-center gap-2 rounded-xl2 border border-dashed border-line px-3 py-2.5 text-[12.5px] text-muted">
        <Icon name="ph:percent" size="15" /> Скидок не запрашивали. До {{ limits.manager }}% — без согласования.
      </p>
    </div>
  </AppCard>
</template>
