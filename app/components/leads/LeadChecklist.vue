<script setup lang="ts">
import type { Lead } from '~/types/models'
import { buildDealChecklist } from '~/utils/leadChecklist'
import { fmtDate } from '~/utils/format'

/**
 * Чек-лист сделки. Считается по фактам (звонки, бронь, договор, платежи), а не
 * по этапу воронки — менеджер видит, что реально сделано, и что осталось.
 */
const props = defineProps<{ lead: Lead; compact?: boolean }>()

const salesStore = useSalesStore()
const dealsStore = useDealsStore()

const contracts = computed(() => dealsStore.contractsForLead(props.lead.id))
const checklist = computed(() => buildDealChecklist({
  lead: props.lead,
  reservations: salesStore.reservationsForLead(props.lead.id),
  contracts: contracts.value,
  payments: contracts.value.flatMap((c) => dealsStore.paymentsFor(c.id)),
  schedule: contracts.value.flatMap((c) => dealsStore.scheduleFor(c.id)),
}))
</script>

<template>
  <div>
    <div v-if="!compact" class="mb-1.5 flex items-baseline justify-between gap-3">
      <p class="text-[11px] font-semibold uppercase tracking-[0.04em] text-muted">Чек-лист сделки</p>
      <p class="tabular text-[11.5px] font-semibold text-ink">{{ checklist.percent }}%</p>
    </div>

    <ol class="flex items-stretch gap-1">
      <li v-for="(s, i) in checklist.steps" :key="s.key" class="relative min-w-0 flex-1">
        <!-- соединительная линия: она и показывает, что это путь, а не набор плашек -->
        <span
          v-if="i > 0" class="absolute left-0 top-[9px] h-[2px] w-full -translate-x-1/2"
          :class="s.done ? 'bg-fill-ok' : 'bg-line'"
        />
        <div class="relative flex flex-col items-center gap-1 text-center">
          <span
            class="grid h-[19px] w-[19px] shrink-0 place-items-center rounded-full border-2 transition-colors"
            :class="s.done
              ? 'border-fill-ok bg-fill-ok text-white'
              : s.current
                ? 'border-plum bg-panel text-plum'
                : 'border-line bg-panel text-muted'"
            :title="s.done && s.at ? `${s.label} · ${fmtDate(s.at)}` : s.hint"
          >
            <Icon :name="s.done ? 'ph:check-bold' : s.icon" :size="s.done ? 10 : 11" />
          </span>
          <span
            class="w-full truncate text-[10px] font-semibold leading-tight"
            :class="s.done ? 'text-ink' : s.current ? 'text-plum' : 'text-muted'"
            :title="s.label"
          >{{ s.label }}</span>
          <span v-if="!compact && s.at" class="text-[9.5px] leading-none text-muted">{{ fmtDate(s.at) }}</span>
        </div>
      </li>
    </ol>

    <p v-if="!compact && checklist.nextStep" class="mt-2 flex items-center gap-1.5 text-[11.5px] text-muted">
      <Icon name="ph:arrow-right" size="12" class="text-plum" />
      Следующий шаг: <b class="text-ink">{{ checklist.nextStep.hint }}</b>
    </p>
  </div>
</template>
