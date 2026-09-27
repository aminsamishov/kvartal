<script setup lang="ts">
import type { Unit } from '~/types/models'
import { hasInterestCriteria, interestFromLead, scoreUnit, type MatchedUnit } from '~/composables/useLeadMatching'
import { matchesUnitFilters } from '~/utils/unitFilters'
import { MAX_COMPARE, type PickerView } from '~/stores/board'

/**
 * Единый подбор помещений. Один компонент на все места, где нужно выбрать
 * квартиру: карточка заявки, бронь, договор, мастер сделок, шахматка.
 *
 * Фильтр, выделение и сравнение живут в скоупе стора подбора, поэтому четыре
 * представления — шахматка, фасад, план этажа, список — показывают один и тот
 * же набор и одно и то же выделение.
 */
const props = withDefaults(defineProps<{
  scopeKey: string
  /** подбор под заявку: включает процент совпадения и бронь из строки */
  leadId?: string
  /** ограничить проектом; по умолчанию — текущий проект в шапке */
  projectId?: string
  /** массовая правка статусов и цен — только там, где это уместно */
  canEdit?: boolean
  /** скрыть выбор проекта: в заявке он приходит из запроса клиента */
  hideProject?: boolean
}>(), { canEdit: false })

const emit = defineEmits<{ open: [string]; reserve: [string] }>()

const board = useBoardStore()
const unitsStore = useUnitsStore()
const salesStore = useSalesStore()
const ui = useUiStore()

const scope = computed(() => board.scope(props.scopeKey))

/* --------------------------------- проект -------------------------------- */

const projects = computed(() => unitsStore.projects.filter((p) => !p.archived))
const lead = computed(() => (props.leadId ? salesStore.lead(props.leadId) : undefined))
const interest = computed(() => (lead.value ? interestFromLead(lead.value) : undefined))

const projectId = ref(props.projectId
  ?? interest.value?.projectIds[0]
  ?? ui.currentProjectId)
watch(() => props.projectId, (v) => { if (v) projectId.value = v })

const buildings = computed(() => unitsStore.buildingsByProject(projectId.value).filter((b) => !b.archived))

watchEffect(() => {
  if (!buildings.value.length) return
  if (!buildings.value.some((b) => b.id === scope.value.buildingId)) {
    // при подборе под клиента начинаем с корпуса из запроса
    const wanted = interest.value?.buildingIds.find((id) => buildings.value.some((b) => b.id === id))
    board.setBuilding(props.scopeKey, wanted ?? buildings.value[0]!.id)
  }
})

const building = computed(() => buildings.value.find((b) => b.id === scope.value.buildingId))
const units = computed<Unit[]>(() => (building.value ? unitsStore.unitsByBuilding(building.value.id) : []))

/* ------------------------------- фильтрация ------------------------------- */

const filters = computed({
  get: () => scope.value.filters,
  set: (v) => board.setFilters(props.scopeKey, v),
})

const matchIds = computed(() => new Set(units.value.filter((u) => matchesUnitFilters(u, filters.value)).map((u) => u.id)))
const matchedUnits = computed(() => units.value.filter((u) => matchIds.value.has(u.id)))

/* -------------------------------- скоринг -------------------------------- */

const scoring = computed(() => Boolean(interest.value && hasInterestCriteria(interest.value)))
const scores = computed(() => {
  if (!scoring.value || !interest.value) return undefined
  const map = new Map<string, MatchedUnit>()
  for (const u of matchedUnits.value) {
    if (u.kind !== 'apartment' && u.kind !== 'commercial') continue
    map.set(u.id, scoreUnit(u, interest.value))
  }
  return map
})

/** Сколько квартир в корпусе попадает в запрос клиента — подсказка на вкладке. */
function buildingMatchCount(buildingId: string) {
  return unitsStore.unitsByBuilding(buildingId).filter((u) => matchesUnitFilters(u, filters.value)).length
}

/* ------------------------------ представления ----------------------------- */

const VIEWS: { value: PickerView; label: string; icon: string }[] = [
  { value: 'board', label: 'Шахматка', icon: 'ph:grid-nine' },
  { value: 'facade', label: 'Фасад', icon: 'ph:building-apartment' },
  { value: 'floor', label: 'План этажа', icon: 'ph:stack' },
  { value: 'list', label: 'Список', icon: 'ph:list-bullets' },
]

/* -------------------------------- сравнение ------------------------------- */

const compareOpen = ref(false)
const compareIds = computed(() => scope.value.selected.slice(0, MAX_COMPARE))

function openCompare() {
  if (scope.value.selected.length < 2) { ui.toast('Отметьте хотя бы две квартиры', 'warn'); return }
  compareOpen.value = true
}

function applyInterest() {
  if (!props.leadId || !interest.value) return
  board.applyInterest(props.scopeKey, props.leadId, interest.value)
  ui.toast('Фильтр собран из запроса клиента', 'ok')
}

// выделение переживает смену дома, но не смену проекта: сравнивать лоты из
// разных ЖК менеджер не просит, а «призрачные» отметки сбивают счётчик
watch(projectId, () => board.clearSelection(props.scopeKey))
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- проект и корпуса -->
    <div class="flex flex-wrap items-center gap-2">
      <AppSelect
        v-if="!hideProject && projects.length > 1"
        :model-value="projectId" class="w-[200px]"
        :options="projects.map((p) => ({ value: p.id, label: p.name }))"
        @update:model-value="projectId = $event"
      />
      <div v-if="buildings.length > 1" class="flex min-w-0 flex-1 gap-1.5 overflow-x-auto">
        <button
          v-for="b in buildings" :key="b.id" type="button"
          class="focus-ring flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-[12.5px] font-semibold transition-colors"
          :class="scope.buildingId === b.id ? 'border-ink bg-ink text-panel' : 'border-line bg-panel text-muted hover:text-ink'"
          @click="board.setBuilding(scopeKey, b.id)"
        >
          {{ b.name }}
          <span
            class="tabular rounded-full px-1.5 text-[10.5px]"
            :class="scope.buildingId === b.id ? 'bg-panel/20' : 'bg-soft text-ink'"
          >{{ buildingMatchCount(b.id) }}</span>
        </button>
      </div>

      <SegmentedControl
        :model-value="scope.view" class="ml-auto shrink-0" :options="VIEWS"
        @update:model-value="board.setView(scopeKey, $event as PickerView)"
      />
    </div>

    <UnitFilterBar v-model="filters" :units="units" :matched="matchIds.size" />

    <!-- подбор под клиента -->
    <div v-if="leadId" class="flex flex-wrap items-center gap-2 rounded-xl2 bg-soft px-3 py-2">
      <Icon name="ph:target" size="15" class="shrink-0 text-plum" />
      <p class="min-w-0 flex-1 text-[12px] text-muted">
        <template v-if="scoring">Проценты считаются по запросу клиента — наведите на квартиру, чтобы увидеть, за что снят балл.</template>
        <template v-else>Заполните запрос клиента на вкладке «Обзор» — подбор начнёт считать совпадение.</template>
      </p>
      <AppButton size="sm" icon="ph:funnel" @click="applyInterest">Фильтр из запроса</AppButton>
    </div>

    <template v-if="building">
      <div v-if="scope.view === 'board'" class="flex flex-wrap items-center gap-2">
        <SegmentedControl
          :model-value="scope.colorMode"
          :options="[{ value: 'status', label: 'Статус', icon: 'ph:tag' }, { value: 'payment', label: 'Оплата', icon: 'ph:hand-coins' }]"
          @update:model-value="board.setColorMode(scopeKey, $event as 'status' | 'payment')"
        />
        <SegmentedControl
          :model-value="scope.cellSize"
          :options="[{ value: 'compact', label: 'Компактно', icon: 'ph:grid-nine' }, { value: 'large', label: 'Крупно', icon: 'ph:squares-four' }]"
          @update:model-value="board.setCellSize(scopeKey, $event as 'compact' | 'large')"
        />
      </div>

      <UnitBoardGrid
        v-if="scope.view === 'board'"
        :scope-key="scopeKey" :units="units" :match-ids="matchIds" :scores="scores"
        @open="emit('open', $event)"
      />
      <UnitFacadeView
        v-else-if="scope.view === 'facade'"
        :scope-key="scopeKey" :building="building" :units="units" :match-ids="matchIds" :scores="scores"
        @open="emit('open', $event)"
      />
      <UnitFloorPlanView
        v-else-if="scope.view === 'floor'"
        :scope-key="scopeKey" :building="building" :units="units" :match-ids="matchIds" :scores="scores"
        @open="emit('open', $event)"
      />
      <UnitListTable
        v-else
        :units="units" :dim-ids="new Set(units.filter((u) => !matchIds.has(u.id)).map((u) => u.id))"
        :scope-key="scopeKey" :scores="scores" @open="emit('open', $event)"
      />
    </template>

    <EmptyState v-else icon="ph:building-apartment" title="В проекте нет домов" text="Выберите другой проект или добавьте дом" />

    <UnitSelectionBar
      :scope-key="scopeKey" :units="units" :can-edit="canEdit" :scores="scores"
      @compare="openCompare"
    />

    <UnitCompareModal
      v-model="compareOpen" :unit-ids="compareIds" :lead-id="leadId" :scores="scores"
      @reserve="emit('reserve', $event)" @open="emit('open', $event)"
    />
  </div>
</template>
