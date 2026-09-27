<script setup lang="ts">
import type { CommKind, CommOutcome, LeadStage } from '~/types/models'
import { COMM_OUTCOME_META } from '~/utils/meta'

/**
 * Карточка заявки. Весь цикл продажи — подбор, бронь, договор, документы —
 * живёт здесь: менеджер не должен уходить на другие экраны, теряя контекст
 * клиента. Вкладок нет: блоки идут одним полотном, а якорная навигация
 * даёт до любого один клик.
 */
const props = defineProps<{ leadId: string | null }>()
const emit = defineEmits<{ close: []; 'request-lost': [string]; navigate: [string] }>()

const salesStore = useSalesStore()
const unitsStore = useUnitsStore()
const dealsStore = useDealsStore()
const auth = useAuthStore()
const ui = useUiStore()

const open = computed({ get: () => !!props.leadId, set: (v) => { if (!v) emit('close') } })
const lead = computed(() => (props.leadId ? salesStore.lead(props.leadId) : undefined))
const client = computed(() => (lead.value ? salesStore.client(lead.value.clientId) : undefined))
const author = computed(() => auth.user?.name ?? 'Система')

const scrollRoot = ref<HTMLElement | null>(null)
const reservation = computed(() => (lead.value ? salesStore.activeReservationForLead(lead.value.id) : undefined))
const contract = computed(() => (lead.value ? dealsStore.contractsForLead(lead.value.id)[0] : undefined))
const docsCount = computed(() => (lead.value ? salesStore.documentsForLead(lead.value.id).length : 0))

const sections = computed(() => [
  { id: 'sec-action', label: 'Действие' },
  { id: 'sec-interest', label: 'Интерес' },
  { id: 'sec-match', label: 'Подбор' },
  { id: 'sec-reserve', label: 'Бронь' },
  { id: 'sec-finance', label: 'Финансы' },
  { id: 'sec-docs', label: 'Документы', count: docsCount.value },
  { id: 'sec-history', label: 'История' },
  { id: 'sec-relations', label: 'Связи' },
])

/* ------------------------------- действия -------------------------------- */

function moveTo(stage: LeadStage) {
  if (!lead.value) return
  if (stage === 'lost') { emit('request-lost', lead.value.id); return }
  salesStore.moveLead(lead.value.id, stage, author.value)
  ui.toast(`Этап: ${stage === 'deal' ? 'Сделка' : stage}`, 'ok')
}

// фиксация контакта: без неё лента истории наполняется только системным
const commFor = ref<CommKind | null>(null)
function startComm(kind: CommKind) {
  if (!client.value?.phone) return
  commFor.value = kind
  const url = kind === 'whatsapp' ? `https://wa.me/${client.value.phone}` : `tel:+${client.value.phone}`
  if (import.meta.client) window.open(url, kind === 'whatsapp' ? '_blank' : '_self')
}
function logComm(outcome: CommOutcome) {
  if (!lead.value || !commFor.value) return
  salesStore.addComm(lead.value.id, { kind: commFor.value, outcome }, author.value)
  if (lead.value.stage === 'new' && outcome === 'answered') salesStore.moveLead(lead.value.id, 'contacted', author.value)
  ui.toast('Контакт зафиксирован', 'ok')
  commFor.value = null
}

const showVisitForm = ref(false)
const reserveUnitId = ref<string | null>(null)

function startReserve() {
  if (!lead.value) return
  const unitId = reservation.value?.unitId ?? lead.value.interestedUnitIds[0]
  if (!unitId) {
    ui.toast('Сначала подберите квартиру', 'warn')
    scrollToSection('sec-match')
    return
  }
  reserveUnitId.value = unitId
}

function goContract(unitId?: string) {
  if (!lead.value) return
  const id = unitId ?? reservation.value?.unitId ?? lead.value.interestedUnitIds[0]
  if (!id) { ui.toast('Сначала подберите квартиру', 'warn'); return }
  // leadId уносим в мастер, чтобы договор знал, из какой заявки он вырос
  navigateTo(`/deals/new?unit=${id}&lead=${lead.value.id}`)
}

/* ------------------------------- сравнение -------------------------------- */

const compareIds = ref<string[]>([])
const compareOpen = ref(false)
function openCompare(ids: string[]) {
  compareIds.value = ids
  compareOpen.value = true
}

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
</script>

<template>
  <AppDrawer v-model="open" width="min(1140px, 100vw)">
    <template v-if="lead">
      <!-- шапка вынесена из скролла: действия всегда под рукой -->
      <div class="sticky -top-4 z-20 -mx-5 -mt-4 mb-4 bg-panel">
        <LeadHeader
          :lead="lead"
          @stage="moveTo"
          @call="startComm('call_out')"
          @whatsapp="startComm('whatsapp')"
          @visit="showVisitForm = true"
          @reserve="startReserve"
          @contract="goContract()"
        />
        <div class="border-b border-line px-5 py-1.5">
          <AnchorNav :items="sections" :scroll-root="scrollRoot" />
        </div>
      </div>

      <div ref="scrollRoot">
        <!-- фиксация результата контакта -->
        <div v-if="commFor" class="mb-4 rounded-card border border-plum bg-plum-soft/40 p-3">
          <p class="text-[12.5px] font-semibold">Чем закончился контакт?</p>
          <div class="mt-2 flex flex-wrap gap-1.5">
            <Chip v-for="(meta, key) in COMM_OUTCOME_META" :key="key" @click="logComm(key)">{{ meta.label }}</Chip>
            <button class="text-[12px] font-medium text-muted hover:text-ink" @click="commFor = null">Пропустить</button>
          </div>
        </div>

        <!-- назначение показа -->
        <div v-if="showVisitForm" class="mb-4">
          <TaskComposer :lead-id="lead.id" default-kind="visit" @done="showVisitForm = false" @cancel="showVisitForm = false" />
        </div>

        <!-- бронь из шапки -->
        <div v-if="reserveUnitId" class="mb-4">
          <ReserveComposer :lead-id="lead.id" :unit-id="reserveUnitId" @done="reserveUnitId = null" @cancel="reserveUnitId = null" />
        </div>

        <!-- две колонки: слева «продать», справа «досье» -->
        <div class="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <div class="flex min-w-0 flex-col gap-4">
            <LeadNextAction :lead="lead" />
            <LeadInterestBlock :lead="lead" @match="scrollToSection('sec-match')" />
            <LeadMatchingUnits :lead="lead" @compare="openCompare" />
            <LeadReservation :lead="lead" @contract="goContract" />
          </div>

          <div class="flex min-w-0 flex-col gap-4">
            <LeadFinance :lead="lead" />
            <LeadDocuments :lead-id="lead.id" :client-id="lead.clientId" />
            <LeadTimeline :lead="lead" />
            <LeadRelations :lead="lead" @open-lead="emit('navigate', $event)" />
          </div>
        </div>
      </div>

      <LeadCompareModal
        v-model="compareOpen" :unit-ids="compareIds" :lead-id="lead.id"
        @reserve="reserveUnitId = $event"
      />
    </template>
  </AppDrawer>
</template>
