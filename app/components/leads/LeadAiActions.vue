<script setup lang="ts">
import type { Lead } from '~/types/models'
import { buildLeadActions, type LeadAction } from '~/utils/leadActions'
import { matchUnits, interestFromLead } from '~/composables/useLeadMatching'

/**
 * Рекомендации следующего шага. Каждая карточка не просто советует, а сразу
 * выполняет действие — совет, требующий пяти кликов, менеджер не выполнит.
 */
const props = defineProps<{ lead: Lead; limit?: number }>()
const emit = defineEmits<{ act: [LeadAction] }>()

const salesStore = useSalesStore()
const dealsStore = useDealsStore()
const unitsStore = useUnitsStore()
const approvalsStore = useApprovalsStore()

const reservation = computed(() => salesStore.activeReservationForLead(props.lead.id))
const contract = computed(() => dealsStore.contractsForLead(props.lead.id)[0])
const balance = computed(() => (contract.value ? dealsStore.balance(contract.value.id) : null))

const topMatch = computed(() => {
  const interest = interestFromLead(props.lead)
  const best = matchUnits(unitsStore.units, interest)[0]
  return best ? { unit: best.unit, score: best.score } : undefined
})

const actions = computed(() => buildLeadActions({
  lead: props.lead,
  taskState: salesStore.taskState(props.lead),
  openTask: salesStore.openTask(props.lead),
  daysInStage: salesStore.daysInStage(props.lead),
  reservation: reservation.value,
  contract: contract.value,
  overdueAmount: balance.value?.overdueAmount ?? 0,
  paidAnything: (balance.value?.paid ?? 0) > 0,
  documents: salesStore.documentsForLead(props.lead.id),
  topMatch: topMatch.value,
  pendingDiscount: approvalsStore.forLead(props.lead.id).find((r) => r.status === 'pending'),
  linkedUnits: props.lead.interestedUnitIds.length,
}))

const shown = computed(() => actions.value.slice(0, props.limit ?? 3))

const TONE: Record<LeadAction['tone'], { wrap: string; icon: string }> = {
  bad: { wrap: 'border-bad/40 bg-bad-bg/50 hover:border-bad', icon: 'bg-bad-bg text-bad' },
  warn: { wrap: 'border-warn/40 bg-warn-bg/40 hover:border-warn', icon: 'bg-warn-bg text-warn' },
  ok: { wrap: 'border-ok/40 bg-ok-bg/40 hover:border-ok', icon: 'bg-ok-bg text-ok' },
  plum: { wrap: 'border-plum/40 bg-plum-soft/40 hover:border-plum', icon: 'bg-plum-soft text-plum' },
  neutral: { wrap: 'border-line hover:border-plum/50', icon: 'bg-soft text-muted' },
}
</script>

<template>
  <AppCard :padded="false">
    <div class="flex items-center justify-between gap-3 px-4 pt-4">
      <h3 class="flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-[0.04em] text-muted">
        <Icon name="ph:lightning" size="14" class="text-plum" /> Что сделать дальше
      </h3>
      <span v-if="actions.length > shown.length" class="tabular text-[11.5px] text-muted">
        ещё {{ actions.length - shown.length }}
      </span>
    </div>

    <div class="p-4">
      <div v-if="shown.length" class="flex flex-col gap-2">
        <button
          v-for="a in shown" :key="a.key" type="button"
          class="focus-ring group flex items-start gap-2.5 rounded-xl2 border p-2.5 text-left transition-colors"
          :class="TONE[a.tone].wrap"
          @click="emit('act', a)"
        >
          <span class="grid h-8 w-8 shrink-0 place-items-center rounded-xl2" :class="TONE[a.tone].icon">
            <Icon :name="a.icon" size="16" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block text-[13px] font-semibold leading-snug text-ink">{{ a.title }}</span>
            <span class="mt-0.5 block text-[11.5px] leading-snug text-muted">{{ a.reason }}</span>
          </span>
          <Icon name="ph:arrow-right" size="14" class="mt-2 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>

      <p v-else class="flex items-center gap-2 rounded-xl2 bg-ok-bg px-3 py-2.5 text-[12.5px] text-ok">
        <Icon name="ph:check-circle" size="15" /> По этой заявке всё в порядке — следующий шаг назначен
      </p>
    </div>
  </AppCard>
</template>
