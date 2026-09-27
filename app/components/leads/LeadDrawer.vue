<script setup lang="ts">
import type { CommKind, CommOutcome, LeadStage } from '~/types/models'
import { COMM_OUTCOME_META } from '~/utils/meta'
import { interestFromLead } from '~/composables/useLeadMatching'
import type { LeadAction } from '~/utils/leadActions'

/**
 * Карточка заявки — рабочее место менеджера. Весь цикл продажи живёт здесь:
 * обзор, подбор с шахматкой и фасадом, финансы, документы, история. Уходить на
 * другие экраны и терять контекст клиента не нужно.
 *
 * Вкладки, а не одно полотно: блоков стало слишком много, и вертикальная
 * прокрутка на два экрана скрывала главное — что делать прямо сейчас.
 */
const props = defineProps<{ leadId: string | null }>()
const emit = defineEmits<{ close: []; 'request-lost': [string]; navigate: [string] }>()

const salesStore = useSalesStore()
const unitsStore = useUnitsStore()
const dealsStore = useDealsStore()
const board = useBoardStore()
const auth = useAuthStore()
const ui = useUiStore()

const open = computed({ get: () => !!props.leadId, set: (v) => { if (!v) emit('close') } })
const lead = computed(() => (props.leadId ? salesStore.lead(props.leadId) : undefined))
const client = computed(() => (lead.value ? salesStore.client(lead.value.clientId) : undefined))
const author = computed(() => auth.user?.name ?? 'Система')

const reservation = computed(() => (lead.value ? salesStore.activeReservationForLead(lead.value.id) : undefined))
const docsCount = computed(() => (lead.value ? salesStore.documentsForLead(lead.value.id).length : 0))
const contract = computed(() => (lead.value ? dealsStore.contractsForLead(lead.value.id)[0] : undefined))

/** Скоуп подбора у каждой заявки свой — выделение не утекает между клиентами. */
const scopeKey = computed(() => `lead:${props.leadId ?? 'none'}`)

type Tab = 'overview' | 'match' | 'finance' | 'docs' | 'history'
const tab = ref<Tab>('overview')
watch(() => props.leadId, () => { tab.value = 'overview' })

const tabs = computed(() => [
  { value: 'overview', label: 'Обзор', icon: 'ph:squares-four' },
  { value: 'match', label: 'Подбор', icon: 'ph:grid-nine', count: lead.value?.interestedUnitIds.length || undefined },
  { value: 'finance', label: 'Финансы', icon: 'ph:calculator' },
  { value: 'docs', label: 'Документы', icon: 'ph:folders', count: docsCount.value || undefined },
  { value: 'history', label: 'История', icon: 'ph:clock-counter-clockwise' },
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
    goPicker()
    return
  }
  reserveUnitId.value = unitId
}

function goContract(unitId?: string) {
  if (!lead.value) return
  const id = unitId ?? reservation.value?.unitId ?? lead.value.interestedUnitIds[0]
  if (!id) { ui.toast('Сначала подберите квартиру', 'warn'); goPicker(); return }
  // leadId уносим в мастер, чтобы договор знал, из какой заявки он вырос
  navigateTo(`/deals/new?unit=${id}&lead=${lead.value.id}`)
}

/* -------------------------------- подбор --------------------------------- */

/** Открыть подбор с фильтром из запроса клиента — один клик от «Обзора». */
function goPicker() {
  if (lead.value) board.applyInterest(scopeKey.value, lead.value.id, interestFromLead(lead.value))
  tab.value = 'match'
}

/**
 * Клик по квартире в подборе привязывает её к заявке: в карточке это «клиент
 * смотрит», из чего потом собирается сравнение, бронь и договор.
 */
function pickUnit(unitId: string) {
  if (!lead.value) return
  const linked = lead.value.interestedUnitIds.includes(unitId)
  salesStore.toggleLeadUnit(lead.value.id, unitId)
  if (linked) board.deselect(scopeKey.value, unitId)
  else board.select(scopeKey.value, unitId)
  ui.toast(linked ? 'Убрали из подборки клиента' : 'Добавили в подборку клиента', linked ? 'info' : 'ok')
}

/* ----------------------------- рекомендации ------------------------------ */

const showTaskForm = ref(false)
const taskKind = ref<'call' | 'visit'>('call')
const completeSignal = ref(0)

/**
 * Рекомендация должна выполняться одним нажатием — иначе она остаётся
 * советом, который никто не выполняет.
 */
function runAction(a: LeadAction) {
  if (!lead.value) return
  switch (a.kind) {
    case 'call': startComm('call_out'); break
    case 'whatsapp': startComm('whatsapp'); break
    case 'complete_task': tab.value = 'overview'; completeSignal.value++; break
    case 'task':
      tab.value = 'overview'
      taskKind.value = a.key === 'visit' ? 'visit' : 'call'
      showTaskForm.value = true
      break
    case 'picker':
      goPicker()
      if (a.unitId) board.select(scopeKey.value, a.unitId)
      break
    case 'reserve': reserveUnitId.value = a.unitId ?? null; break
    case 'extend':
      if (reservation.value) {
        salesStore.extendReservation(reservation.value.id, 3, author.value)
        ui.toast('Бронь продлена на 3 дня', 'ok')
      }
      break
    case 'contract': goContract(a.unitId); break
    case 'docs': tab.value = 'docs'; break
    case 'approvals': tab.value = 'finance'; break
    case 'payment':
      if (contract.value) navigateTo(`/contracts/${contract.value.id}`)
      else tab.value = 'finance'
      break
    case 'lost': emit('request-lost', lead.value.id); break
  }
}

/** Полная карточка помещения поверх карточки заявки — из мини-карточки подбора. */
const unitCardId = ref<string | null>(null)
watch(() => props.leadId, () => { unitCardId.value = null })

// Горячие клавиши карточки. На вкладке «Подбор» их перехватывает сам подбор —
// там у B и D есть конкретная выделенная квартира, а здесь действие идёт
// по активной брони заявки.
useHotkeys({
  enabled: () => Boolean(props.leadId) && tab.value !== 'match',
  reserve: startReserve,
  contract: () => goContract(),
  compare: goPicker,
})

const linkedUnits = computed(() => (lead.value?.interestedUnitIds ?? [])
  .map((id) => unitsStore.unit(id))
  .filter((u): u is NonNullable<typeof u> => !!u))
</script>

<template>
  <AppDrawer v-model="open" width="min(1180px, 100vw)">
    <template v-if="lead">
      <!-- шапка вынесена из скролла: действия и вкладки всегда под рукой -->
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
        <div class="px-5">
          <Tabs :model-value="tab" :tabs="tabs" @update:model-value="tab = $event as Tab" />
        </div>
      </div>

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

      <!-- задача из рекомендации -->
      <div v-if="showTaskForm" class="mb-4">
        <TaskComposer :lead-id="lead.id" :default-kind="taskKind" @done="showTaskForm = false" @cancel="showTaskForm = false" />
      </div>

      <!-- бронь из шапки и из подбора -->
      <div v-if="reserveUnitId" class="mb-4">
        <ReserveComposer :lead-id="lead.id" :unit-id="reserveUnitId" @done="reserveUnitId = null" @cancel="reserveUnitId = null" />
      </div>

      <!-- ОБЗОР -->
      <div v-if="tab === 'overview'" class="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div class="flex min-w-0 flex-col gap-4">
          <LeadNextAction :lead="lead" :complete-signal="completeSignal" />
          <LeadAiActions :lead="lead" @act="runAction" />
          <LeadInterestBlock :lead="lead" @match="goPicker" />
          <LeadMatchingUnits :lead="lead" @picker="goPicker" @open="pickUnit" />
        </div>

        <div class="flex min-w-0 flex-col gap-4">
          <AppCard>
            <LeadChecklist :lead="lead" />
          </AppCard>
          <LeadAiSummary :lead="lead" />
          <LeadReservation :lead="lead" @contract="goContract" />
          <LeadProfileCard :lead="lead" />
          <LeadRelations :lead="lead" @open-lead="emit('navigate', $event)" />
        </div>
      </div>

      <!-- ПОДБОР -->
      <div v-else-if="tab === 'match'" class="flex flex-col gap-4">
        <div v-if="linkedUnits.length" class="rounded-card border border-line bg-panel p-3 shadow-card">
          <p class="mb-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted">
            Подборка клиента · {{ linkedUnits.length }}
          </p>
          <div class="flex flex-col gap-2">
            <LeadUnitRow
              v-for="u in linkedUnits" :key="u.id" :unit="u" linked
              @reserve="reserveUnitId = $event" @open="pickUnit"
            />
          </div>
        </div>

        <UnitPicker
          :scope-key="scopeKey" :lead-id="lead.id" :linked-ids="lead.interestedUnitIds"
          @link="pickUnit" @open="unitCardId = $event" @reserve="reserveUnitId = $event" @contract="goContract"
        />

        <p class="flex items-start gap-1.5 text-[11.5px] text-muted">
          <Icon name="ph:info" size="13" class="mt-0.5 shrink-0" />
          Клик по квартире добавляет её в подборку клиента, Ctrl+клик — выделяет для сравнения и массовых действий.
          Выделение общее для шахматки, фасада и плана этажа.
        </p>
      </div>

      <!-- ФИНАНСЫ -->
      <div v-else-if="tab === 'finance'" class="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <LeadFinance :lead="lead" />
        <div class="flex min-w-0 flex-col gap-4">
          <LeadReservation :lead="lead" @contract="goContract" />
          <AppCard v-if="!contract" title="Договор" subtitle="Оформляется из брони или из подбора">
            <AppButton variant="primary" icon="ph:file-text" block :disabled="lead.stage === 'lost'" @click="goContract()">
              Создать договор
            </AppButton>
          </AppCard>
        </div>
      </div>

      <!-- ДОКУМЕНТЫ -->
      <LeadDocuments v-else-if="tab === 'docs'" :lead-id="lead.id" :client-id="lead.clientId" />

      <!-- ИСТОРИЯ -->
      <div v-else class="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <LeadTimeline :lead="lead" />
        <div class="flex min-w-0 flex-col gap-4">
          <AppCard>
            <LeadChecklist :lead="lead" />
          </AppCard>
          <LeadRelations :lead="lead" @open-lead="emit('navigate', $event)" />
        </div>
      </div>

      <!-- карточка помещения поверх карточки заявки: открывается из подбора -->
      <UnitDrawer :unit-id="unitCardId" @close="unitCardId = null" @navigate="unitCardId = $event" />
    </template>
  </AppDrawer>
</template>
