<script setup lang="ts">
import type { Unit } from '~/types/models'
import { hasInterestCriteria, interestFromLead, scoreUnit, type MatchedUnit } from '~/composables/useLeadMatching'
import { matchesUnitFilters } from '~/utils/unitFilters'
import { MAX_COMPARE, type PickerView } from '~/stores/board'

/**
 * Единый подбор помещений. Один компонент на все места, где нужно выбрать
 * квартиру: карточка заявки, бронь, договор, мастер сделок, шахматка.
 *
 * Навигация идёт сверху вниз — генплан → дом → фасад → этаж, — а фильтр,
 * выделение и сравнение живут в скоупе стора подбора, поэтому все пять
 * представлений показывают один и тот же набор и одно и то же выделение.
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
  /** id помещений, уже добавленных в подборку клиента */
  linkedIds?: string[]
  /**
   * Витрина показа пристыкована к подбору, а не лежит поверх него: рендер
   * дома сужается, но остаётся на экране. Так она ведёт себя там, где подбор
   * — главный экран (шахматка). Внутри карточки заявки места на колонку нет,
   * поэтому там витрина по-прежнему накрывает экран.
   */
  docked?: boolean
}>(), { canEdit: false, linkedIds: () => [], docked: false })

const emit = defineEmits<{
  open: [string]
  reserve: [string]
  contract: [string]
  link: [string]
  /** витрина заняла правую колонку — карточке помещения там больше не место */
  'close-card': []
}>()

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

const project = computed(() => unitsStore.project(projectId.value))
const buildings = computed(() => unitsStore.buildingsByProject(projectId.value).filter((b) => !b.archived))
const projectUnits = computed(() => unitsStore.unitsByProject(projectId.value))

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
    // у проданного и того, что в рассрочке, процент совпадения — шум:
    // предложить клиенту эту квартиру всё равно нельзя
    if (u.status !== 'free' && u.status !== 'reserved') continue
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
  { value: 'master', label: 'Генплан', icon: 'ph:map-trifold' },
  { value: 'board', label: 'Шахматка', icon: 'ph:grid-nine' },
  { value: 'facade', label: 'Фасад', icon: 'ph:building-apartment' },
  { value: 'floor', label: 'План этажа', icon: 'ph:stack' },
  { value: 'list', label: 'Список', icon: 'ph:list-bullets' },
]

/** Цепочка навигации: ЖК → дом → ракурс → этаж. Каждое звено кликабельно. */
const chain = computed(() => {
  const out: { key: string; label: string; view: PickerView; active: boolean }[] = [
    { key: 'project', label: project.value?.name ?? 'Проект', view: 'master', active: scope.value.view === 'master' },
  ]
  if (building.value) {
    out.push({ key: 'building', label: building.value.name, view: 'board', active: scope.value.view === 'board' || scope.value.view === 'list' })
    if (scope.value.view === 'facade') {
      const facade = building.value.facades.find((f) => f.id === scope.value.facadeId)
      out.push({ key: 'facade', label: facade?.name ?? 'Фасад', view: 'facade', active: true })
    }
    if (scope.value.view === 'floor') {
      out.push({ key: 'floor', label: `Этаж ${scope.value.floor ?? '—'}`, view: 'floor', active: true })
    }
  }
  return out
})

function pickBuilding(buildingId: string) {
  board.setBuilding(props.scopeKey, buildingId)
  board.setView(props.scopeKey, 'facade')
}

function boardBuilding(buildingId: string) {
  board.setBuilding(props.scopeKey, buildingId)
  board.setView(props.scopeKey, 'board')
}

/* ------------------------------ липкие фильтры ---------------------------- */

// Маячок стоит над панелью: как только он уходит вверх за шапку, панель
// «приклеилась» — добавляем ей рамку и тень, иначе она сливается с контентом.
const filterSentinel = ref<HTMLElement | null>(null)
const stuck = ref(false)
useIntersectionObserver(filterSentinel, ([entry]) => {
  stuck.value = !(entry?.isIntersecting ?? true)
}, { rootMargin: '-72px 0px 0px 0px' })

/* ------------------------------- мини-карточка ---------------------------- */

const pointer = reactive({ x: 0, y: 0 })
function trackPointer(e: PointerEvent) {
  pointer.x = e.clientX
  pointer.y = e.clientY
}

const miniId = ref<string | null>(null)
const miniPos = reactive({ x: 0, y: 0 })

/** Клик по помещению открывает мини-карточку, а не дровер: контекст важнее. */
function onUnitClick(unitId: string) {
  miniPos.x = pointer.x
  miniPos.y = pointer.y
  miniId.value = unitId
}

function closeMini() {
  miniId.value = null
}
function fromMini(action: 'open' | 'reserve' | 'contract' | 'link', unitId: string) {
  miniId.value = null
  // emit с именем-объединением не проходит по перегрузкам типизированных
  // эмитов, поэтому разводим события явно
  if (action === 'open') emit('open', unitId)
  else if (action === 'reserve') emit('reserve', unitId)
  else if (action === 'contract') emit('contract', unitId)
  else emit('link', unitId)
}

/* ------------------------------ витрина этажа ----------------------------- */

/**
 * Клиентский путь: блок на фасаде → этаж с планировками → квартира. Панель
 * живёт справа и не закрывает рендер дома — разговор идёт по картинке.
 */
const showcase = ref<{ floor: number; section: number; unitId: string | null } | null>(null)

function openFloorShowcase(payload: { floor: number; section: number }) {
  showcase.value = { floor: payload.floor, section: payload.section, unitId: null }
  board.setFloor(props.scopeKey, payload.floor)
  emit('close-card')
}

function openUnitShowcase(unitId: string) {
  const unit = unitsStore.unit(unitId)
  if (!unit) return
  showcase.value = { floor: unit.floor, section: unit.section, unitId }
  board.setFloor(props.scopeKey, unit.floor)
  emit('close-card')
}

/**
 * «Открыть полную карточку» — это передача эстафеты, а не второе окно:
 * витрина уходит, её место занимает карточка помещения.
 */
function openFullCard(unitId: string) {
  showcase.value = null
  emit('open', unitId)
}

/** «Открыть план этажа» из панели — тот же этаж отдельным видом. */
function showFloorPlan(floor: number) {
  board.setFloor(props.scopeKey, floor)
  board.setView(props.scopeKey, 'floor')
  showcase.value = null
}

watch(() => scope.value.buildingId, () => { showcase.value = null })

/* -------------------------------- сравнение ------------------------------- */

/**
 * Сравнение живёт в панели снизу — как слой в Figma: шахматка остаётся на
 * экране, разница появляется под ней. Модальное окно осталось для разбора
 * крупных планировок с клиентом.
 */
const compareTray = ref(false)
const compareOpen = ref(false)
const compareIds = computed(() => scope.value.selected.slice(0, MAX_COMPARE))
const lastSelected = computed(() => {
  const id = scope.value.selected[scope.value.selected.length - 1]
  return id ? unitsStore.unit(id) : undefined
})

function toggleCompare() {
  if (compareTray.value) { compareTray.value = false; return }
  if (scope.value.selected.length < 2) { ui.toast('Отметьте хотя бы две квартиры — Ctrl+клик', 'warn'); return }
  compareTray.value = true
}

function openCompareFull() {
  if (scope.value.selected.length < 2) { ui.toast('Отметьте хотя бы две квартиры — Ctrl+клик', 'warn'); return }
  compareOpen.value = true
}

function applyInterest() {
  if (!props.leadId || !interest.value) return
  board.applyInterest(props.scopeKey, props.leadId, interest.value)
  ui.toast('Фильтр собран из запроса клиента', 'ok')
}

/* ------------------------------ горячие клавиши --------------------------- */

useHotkeys({
  enabled: () => !compareOpen.value,
  compare: toggleCompare,
  reserve: () => {
    const unit = lastSelected.value ?? (miniId.value ? unitsStore.unit(miniId.value) : undefined)
    if (!unit) { ui.toast('Отметьте квартиру — Ctrl+клик по ячейке', 'info'); return }
    if (unit.status !== 'free') { ui.toast(`№ ${unit.number} недоступна для брони`, 'warn'); return }
    emit('reserve', unit.id)
  },
  contract: () => {
    const unit = lastSelected.value ?? (miniId.value ? unitsStore.unit(miniId.value) : undefined)
    if (!unit) { ui.toast('Отметьте квартиру — Ctrl+клик по ячейке', 'info'); return }
    emit('contract', unit.id)
  },
  escape: () => {
    if (miniId.value) closeMini()
    else if (compareTray.value) compareTray.value = false
    else if (scope.value.selected.length) board.clearSelection(props.scopeKey)
  },
})

// выделение переживает смену дома, но не смену проекта: сравнивать лоты из
// разных ЖК менеджер не просит, а «призрачные» отметки сбивают счётчик
watch(projectId, () => board.clearSelection(props.scopeKey))
watch(() => scope.value.view, closeMini)
// сравнивать нечего — панель закрывается сама, иначе она висит пустой
watch(() => scope.value.selected.length, (n) => { if (n < 2) compareTray.value = false })
</script>

<template>
  <!--
    Подбор и витрина показа стоят рядом, а не друг на друге: когда витрина
    пристыкована, рендер дома сужается, но менеджер продолжает водить по
    фасаду, не закрывая карточку. Без витрины колонка одна, и ряд ведёт себя
    как обычный блок.
  -->
  <div class="flex items-start gap-4">
    <div class="flex min-w-0 flex-1 flex-col gap-3" @pointerdown="trackPointer">
      <!-- цепочка навигации и представления -->
      <div class="flex flex-wrap items-center gap-2">
        <AppSelect
          v-if="!hideProject && projects.length > 1"
          :model-value="projectId" class="w-[190px]"
          :options="projects.map((p) => ({ value: p.id, label: p.name }))"
          @update:model-value="projectId = $event"
        />

        <nav class="flex min-w-0 flex-wrap items-center gap-1">
          <template v-for="(step, i) in chain" :key="step.key">
            <Icon v-if="i" name="ph:caret-right" size="11" class="shrink-0 text-muted" />
            <button
              type="button"
              class="focus-ring shrink-0 rounded-lg px-2 py-1 text-[12.5px] font-semibold transition-colors"
              :class="step.active ? 'bg-soft text-ink' : 'text-muted hover:text-ink'"
              @click="board.setView(scopeKey, step.view)"
            >{{ step.label }}</button>
          </template>
        </nav>

        <SegmentedControl
          :model-value="scope.view" class="ml-auto shrink-0" :options="VIEWS"
          @update:model-value="board.setView(scopeKey, $event as PickerView)"
        />
      </div>

      <!-- корпуса: на генплане не нужны, там дома выбирают прямо на плане -->
      <div v-if="scope.view !== 'master' && buildings.length > 1" class="flex gap-1.5 overflow-x-auto">
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

      <!-- фильтры: липкие, чтобы не возвращаться к ним прокруткой -->
      <div v-if="scope.view !== 'master'" ref="filterSentinel" class="h-px" />
      <div
        v-if="scope.view !== 'master'"
        class="sticky top-[62px] z-20 -mx-1 rounded-card border px-2 py-2 transition-all duration-150"
        :class="stuck ? 'border-line bg-panel/92 shadow-card backdrop-blur' : 'border-transparent bg-transparent'"
      >
        <UnitFilterBar v-model="filters" :units="units" :matched="matchIds.size" />
      </div>

      <!-- подбор под клиента -->
      <div v-if="leadId && scope.view !== 'master'" class="flex flex-wrap items-center gap-2 rounded-xl2 bg-soft px-3 py-2">
        <Icon name="ph:target" size="15" class="shrink-0 text-plum" />
        <p class="min-w-0 flex-1 text-[12px] text-muted">
          <template v-if="scoring">Проценты считаются по запросу клиента — клик по квартире откроет карточку с разбором.</template>
          <template v-else>Заполните запрос клиента на вкладке «Обзор» — подбор начнёт считать совпадение.</template>
        </p>
        <AppButton size="sm" icon="ph:funnel" @click="applyInterest">Фильтр из запроса</AppButton>
      </div>

      <!-- генплан -->
      <UnitMasterPlanView
        v-if="scope.view === 'master' && project"
        :scope-key="scopeKey" :project="project" :buildings="buildings" :units="projectUnits"
        @pick="pickBuilding" @board="boardBuilding"
      />

      <template v-else-if="building">
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
          <p class="ml-auto hidden items-center gap-1.5 text-[11.5px] text-muted sm:flex">
            <kbd class="hot">Ctrl</kbd>+клик — выделить,
            <kbd class="hot">B</kbd> бронь, <kbd class="hot">D</kbd> договор, <kbd class="hot">C</kbd> сравнение
          </p>
        </div>

        <UnitBoardGrid
          v-if="scope.view === 'board'"
          :scope-key="scopeKey" :units="units" :match-ids="matchIds" :scores="scores" :tooltip="!miniId"
          @open="onUnitClick"
        />
        <UnitFacadeView
          v-else-if="scope.view === 'facade'"
          :scope-key="scopeKey" :building="building" :units="units" :match-ids="matchIds" :scores="scores" :tooltip="!miniId"
          :can-edit="canEdit"
          @open="onUnitClick" @block="openFloorShowcase"
        />
        <UnitFloorPlanView
          v-else-if="scope.view === 'floor'"
          :scope-key="scopeKey" :building="building" :units="units" :match-ids="matchIds" :scores="scores" :tooltip="!miniId"
          @open="openUnitShowcase"
        />
        <UnitListTable
          v-else
          :units="units" :dim-ids="new Set(units.filter((u) => !matchIds.has(u.id)).map((u) => u.id))"
          :scope-key="scopeKey" :scores="scores"
          @open="onUnitClick" @reserve="emit('reserve', $event)" @contract="emit('contract', $event)"
        />
      </template>

      <EmptyState v-else icon="ph:building-apartment" title="В проекте нет домов" text="Выберите другой проект или добавьте дом" />

      <UnitSelectionBar
        :scope-key="scopeKey" :units="units" :can-edit="canEdit" :scores="scores"
        :comparing="compareTray" :lead-id="leadId"
        @compare="toggleCompare" @expand="openCompareFull"
        @reserve="emit('reserve', $event)" @contract="emit('contract', $event)" @open="emit('open', $event)"
      />

      <UnitMiniCard
        v-if="miniId" :unit-id="miniId" :x="miniPos.x" :y="miniPos.y"
        :score="scores?.get(miniId)" :lead-id="leadId"
        :linked="linkedIds.includes(miniId)" :selected="scope.selected.includes(miniId)"
        @close="closeMini"
        @open="fromMini('open', $event)"
        @reserve="fromMini('reserve', $event)"
        @contract="fromMini('contract', $event)"
        @link="fromMini('link', $event)"
        @toggle-select="board.toggleSelect(scopeKey, $event)"
      />
    </div>

    <UnitShowcasePanel
      v-if="showcase && building"
      :building="building" :units="units" :scope-key="scopeKey" :docked="docked"
      :floor="showcase.floor" :section="showcase.section" :unit-id="showcase.unitId"
      :project-name="project?.name"
      @close="showcase = null"
      @update:floor="showcase = { ...showcase, floor: $event, unitId: null }"
      @update:unit="showcase = { ...showcase, unitId: $event }"
      @open-plan="showFloorPlan"
      @open="openFullCard"
      @reserve="emit('reserve', $event)"
    />

    <UnitCompareModal
      v-model="compareOpen" :unit-ids="compareIds" :lead-id="leadId" :scores="scores"
      @reserve="emit('reserve', $event)" @open="emit('open', $event)"
    />
  </div>
</template>

<style scoped>
.hot {
  font-family: var(--f-ui);
  font-size: 9.5px;
  font-weight: 700;
  padding: 1px 4px;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: var(--panel);
  color: var(--ink);
}
</style>
