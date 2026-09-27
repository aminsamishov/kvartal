<script setup lang="ts">
import type { Lead } from '~/types/models'
import { buildDealChecklist } from '~/utils/leadChecklist'
import { buildLeadSummary, WIN_CHANCE_META } from '~/utils/leadSummary'

/**
 * Резюме клиента одной строкой. Менеджер открывает карточку перед звонком и
 * должен понять контекст за пять секунд, а не листать ленту на сорок событий.
 */
const props = defineProps<{ lead: Lead }>()

const salesStore = useSalesStore()
const unitsStore = useUnitsStore()
const dealsStore = useDealsStore()

const reservation = computed(() => salesStore.activeReservationForLead(props.lead.id))
const contract = computed(() => dealsStore.contractsForLead(props.lead.id)[0])
const balance = computed(() => (contract.value ? dealsStore.balance(contract.value.id) : null))

const unit = computed(() => {
  if (contract.value) return unitsStore.unit(contract.value.unitIds[0] ?? '')
  if (reservation.value) return unitsStore.unit(reservation.value.unitId)
  return unitsStore.unit(props.lead.interestedUnitIds[0] ?? '')
})
const project = computed(() => {
  const id = props.lead.interest.projectIds[0] ?? unit.value?.projectId
  return id ? unitsStore.project(id) : undefined
})

const contracts = computed(() => dealsStore.contractsForLead(props.lead.id))
const checklist = computed(() => buildDealChecklist({
  lead: props.lead,
  reservations: salesStore.reservationsForLead(props.lead.id),
  contracts: contracts.value,
  payments: contracts.value.flatMap((c) => dealsStore.paymentsFor(c.id)),
  schedule: contracts.value.flatMap((c) => dealsStore.scheduleFor(c.id)),
}))

const summary = computed(() => buildLeadSummary({
  lead: props.lead,
  reservation: reservation.value,
  contract: contract.value,
  unit: unit.value,
  project: project.value,
  daysInStage: salesStore.daysInStage(props.lead),
  taskState: salesStore.taskState(props.lead),
  nextStep: checklist.value.nextStep,
  overdueAmount: balance.value?.overdueAmount,
}))

const showSignals = ref(false)
const meta = computed(() => WIN_CHANCE_META[summary.value.chance])
const barClass = computed(() => ({ ok: 'bg-fill-ok', warn: 'bg-warn', bad: 'bg-fill-bad' }[meta.value.tone]))
</script>

<template>
  <AppCard :padded="false">
    <div class="flex items-center justify-between gap-3 px-4 pt-4">
      <h3 class="flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-[0.04em] text-muted">
        <Icon name="ph:sparkle" size="14" class="text-plum" /> Резюме клиента
      </h3>
      <StatusTag :tone="meta.tone" size="sm" dot>{{ meta.label }}</StatusTag>
    </div>

    <div class="p-4">
      <p class="text-[13.5px] leading-relaxed text-ink">{{ summary.text }}</p>

      <div class="mt-3 flex items-center gap-2">
        <div class="h-[5px] flex-1 overflow-hidden rounded-full bg-soft">
          <span class="block h-full rounded-full transition-all" :class="barClass" :style="{ width: `${summary.chanceScore}%` }" />
        </div>
        <span class="tabular shrink-0 text-[11.5px] font-semibold text-muted">{{ summary.chanceScore }} / 100</span>
      </div>

      <button
        v-if="summary.signals.length"
        class="mt-2 flex items-center gap-1 text-[12px] font-medium text-muted hover:text-ink"
        @click="showSignals = !showSignals"
      >
        <Icon :name="showSignals ? 'ph:caret-up' : 'ph:caret-down'" size="12" />
        Из чего собрана оценка · {{ summary.signals.length }}
      </button>
      <div v-if="showSignals" class="mt-2 flex flex-wrap gap-1.5">
        <span
          v-for="s in summary.signals" :key="s.label"
          class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-medium"
          :class="{
            ok: 'bg-ok-bg text-ok', warn: 'bg-warn-bg text-warn',
            bad: 'bg-bad-bg text-bad', neutral: 'bg-soft text-muted',
          }[s.tone]"
        >
          <Icon :name="s.icon" size="11" /> {{ s.label }}
        </span>
      </div>
    </div>
  </AppCard>
</template>
