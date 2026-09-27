<script setup lang="ts">
import type { Lead } from '~/types/models'
import { LEAD_STAGE_META, UNIT_STATUS_META } from '~/utils/meta'
import { fmtDate, money } from '~/utils/format'

// Связи: всё, что у клиента уже было, и что известно про квартиру.
// Без этого менеджер не видит, что человек обращается второй раз.
const props = defineProps<{ lead: Lead }>()
const emit = defineEmits<{ openLead: [string] }>()

const salesStore = useSalesStore()
const unitsStore = useUnitsStore()
const dealsStore = useDealsStore()

const clientLeads = computed(() => salesStore.leadsForClient(props.lead.clientId).filter((l) => l.id !== props.lead.id))
const clientReservations = computed(() => salesStore.reservationsForClient(props.lead.clientId))
const clientContracts = computed(() => dealsStore.contractsForClient(props.lead.clientId))
const contractsSum = computed(() => clientContracts.value.reduce((s, c) => s + c.price, 0))

// квартира в фокусе: из договора → из брони → первая интересующая
const focusUnit = computed(() => {
  const ct = dealsStore.contractsForLead(props.lead.id)[0]
  if (ct) return unitsStore.unit(ct.unitIds[0] ?? '')
  const res = salesStore.activeReservationForLead(props.lead.id)
  if (res) return unitsStore.unit(res.unitId)
  return unitsStore.unit(props.lead.interestedUnitIds[0] ?? '')
})

const unitHistory = computed(() => (focusUnit.value ? unitsStore.historyFor(focusUnit.value.id) : []))
const priceHistory = computed(() => unitHistory.value.filter((h) => h.kind === 'price'))
const statusHistory = computed(() => unitHistory.value.filter((h) => h.kind === 'status'))
const alsoInterested = computed(() => (focusUnit.value
  ? salesStore.leadsInterestedInUnit(focusUnit.value.id).filter((l) => l.id !== props.lead.id)
  : []))

const showUnitHistory = ref(false)
</script>

<template>
  <AppCard id="sec-relations" :padded="false">
    <div class="px-4 pt-4">
      <h3 class="text-[13px] font-semibold uppercase tracking-[0.04em] text-muted">Связи</h3>
    </div>

    <div class="p-4">
      <!-- клиент -->
      <p class="mb-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted">Клиент</p>
      <div class="grid grid-cols-3 gap-px overflow-hidden rounded-xl2 border border-line bg-line">
        <div class="bg-panel px-2.5 py-2 text-center">
          <p class="tabular text-[16px] font-semibold text-ink">{{ clientLeads.length + 1 }}</p>
          <p class="text-[10.5px] text-muted">заявок</p>
        </div>
        <div class="bg-panel px-2.5 py-2 text-center">
          <p class="tabular text-[16px] font-semibold text-ink">{{ clientReservations.length }}</p>
          <p class="text-[10.5px] text-muted">броней</p>
        </div>
        <div class="bg-panel px-2.5 py-2 text-center">
          <p class="tabular text-[16px] font-semibold text-ink">{{ clientContracts.length }}</p>
          <p class="text-[10.5px] text-muted">договоров</p>
        </div>
      </div>
      <p v-if="contractsSum" class="mt-1.5 text-[12px] text-muted">
        Куплено на <b class="tabular text-ink">{{ money(contractsSum) }}</b>
      </p>

      <div v-if="clientLeads.length" class="mt-2.5 flex flex-col gap-1">
        <button
          v-for="l in clientLeads.slice(0, 4)" :key="l.id" type="button"
          class="focus-ring flex items-center gap-2 rounded-lg bg-soft px-2.5 py-1.5 text-left text-[12px] hover:bg-line/50"
          @click="emit('openLead', l.id)"
        >
          <StatusTag :tone="LEAD_STAGE_META[l.stage].tone" size="sm" dot>{{ LEAD_STAGE_META[l.stage].label }}</StatusTag>
          <span class="min-w-0 flex-1 truncate text-muted">{{ l.source }} · {{ fmtDate(l.createdAt) }}</span>
          <span class="tabular shrink-0 font-medium">{{ l.budget ? money(l.budget) : '—' }}</span>
        </button>
      </div>

      <!-- квартира -->
      <template v-if="focusUnit">
        <p class="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted">Квартира № {{ focusUnit.number }}</p>
        <div class="flex items-center gap-2 rounded-xl2 border border-line px-2.5 py-2">
          <StatusTag :tone="UNIT_STATUS_META[focusUnit.status].tone" size="sm" dot>{{ UNIT_STATUS_META[focusUnit.status].label }}</StatusTag>
          <span class="min-w-0 flex-1 truncate text-[12px] text-muted">
            {{ unitsStore.building(focusUnit.buildingId)?.name }} · эт. {{ focusUnit.floor }}
          </span>
          <span class="tabular shrink-0 text-[12.5px] font-semibold">{{ money(focusUnit.price) }}</span>
        </div>

        <div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-muted">
          <span>Цена: изменений {{ priceHistory.length }}</span>
          <span>Статус: смен {{ statusHistory.length }}</span>
          <span>Интересовались: {{ alsoInterested.length }}</span>
        </div>

        <button
          v-if="unitHistory.length" class="mt-1.5 flex items-center gap-1 text-[12px] font-medium text-muted hover:text-ink"
          @click="showUnitHistory = !showUnitHistory"
        >
          <Icon :name="showUnitHistory ? 'ph:caret-up' : 'ph:caret-down'" size="12" /> История помещения
        </button>
        <div v-if="showUnitHistory" class="mt-1.5 flex flex-col gap-1">
          <div v-for="h in unitHistory.slice(0, 8)" :key="h.id" class="flex items-center gap-2 rounded-lg bg-soft px-2.5 py-1.5 text-[11.5px]">
            <Icon :name="h.kind === 'price' ? 'ph:tag' : 'ph:swap'" size="12" class="shrink-0 text-muted" />
            <span class="min-w-0 flex-1 truncate">
              {{ h.kind === 'price' ? 'Цена' : 'Статус' }}: {{ h.from ?? '—' }} → {{ h.to ?? '—' }}
            </span>
            <span class="shrink-0 text-muted">{{ fmtDate(h.at) }}</span>
          </div>
        </div>

        <div v-if="alsoInterested.length" class="mt-2 rounded-xl2 bg-warn-bg px-2.5 py-2 text-[11.5px] text-warn">
          <Icon name="ph:users-three" size="12" class="mr-1 inline" />
          Эту квартиру смотрят ещё {{ alsoInterested.length }} клиент(ов) — стоит поторопить
        </div>
      </template>
    </div>
  </AppCard>
</template>
