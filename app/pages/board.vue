<script setup lang="ts">
import { emptyUnitFilters, type UnitFilterState } from '~/utils/unitFilters'
import { UNIT_KIND_META, UNIT_STATUS_META } from '~/utils/meta'
import { PAYMENT_HEALTH_META, healthFromBucket, type PaymentHealth } from '~/utils/board'
import type { Unit, UnitKind, UnitStatus } from '~/types/models'

definePageMeta({ breadcrumb: [{ label: 'Мои объекты', to: '/objects' }, { label: 'Шахматка' }] })

const route = useRoute()
const unitsStore = useUnitsStore()
const dealsStore = useDealsStore()
const ui = useUiStore()

const viewMode = ref<'compact' | 'large' | 'list'>('compact')
const colorMode = ref<'status' | 'payment'>('status')
const activeBuildingId = ref<string>((route.query.building as string) || '')
const activeUnitId = ref<string | null>((route.query.unit as string) || null)

const filters = ref<UnitFilterState>(emptyUnitFilters())
const filtersOpen = ref(false)
const filterPopoverRoot = ref<HTMLElement | null>(null)
onClickOutside(filterPopoverRoot, () => (filtersOpen.value = false))
const rangeFilterCount = computed(() => {
  const f = filters.value
  let n = 0
  if (f.roomsMin || f.roomsMax) n++
  if (f.priceMin || f.priceMax) n++
  if (f.areaMin || f.areaMax) n++
  return n
})

const buildings = computed(() => unitsStore.buildingsByProject(ui.currentProjectId))

watchEffect(() => {
  if (!buildings.value.length) return
  if (!buildings.value.find((b) => b.id === activeBuildingId.value)) {
    activeBuildingId.value = buildings.value[0]!.id
  }
})

const activeBuilding = computed(() => buildings.value.find((b) => b.id === activeBuildingId.value))
const buildingUnits = computed(() => (activeBuilding.value ? unitsStore.unitsByBuilding(activeBuilding.value.id) : []))

const kindOptions = computed(() => {
  const present = new Set(buildingUnits.value.map((u) => u.kind))
  return (Object.entries(UNIT_KIND_META) as [UnitKind, typeof UNIT_KIND_META[UnitKind]][]).filter(([key]) => present.has(key))
})
function toggleKind(kind: UnitKind) {
  const i = filters.value.kinds.indexOf(kind)
  if (i === -1) filters.value.kinds.push(kind)
  else filters.value.kinds.splice(i, 1)
}

function matches(u: Unit) {
  const f = filters.value
  if (f.kinds.length && !f.kinds.includes(u.kind)) return false
  if (f.statuses.length && !f.statuses.includes(u.status)) return false
  if (f.roomsMin && u.rooms < Number(f.roomsMin)) return false
  if (f.roomsMax && u.rooms > Number(f.roomsMax)) return false
  if (f.priceMin && u.price < Number(f.priceMin)) return false
  if (f.priceMax && u.price > Number(f.priceMax)) return false
  if (f.areaMin && u.area < Number(f.areaMin)) return false
  if (f.areaMax && u.area > Number(f.areaMax)) return false
  return true
}
const dimIds = computed(() => new Set(buildingUnits.value.filter((u) => !matches(u)).map((u) => u.id)))

const livingUnits = computed(() => buildingUnits.value.filter((u) => u.floor >= 1))
const parkingUnits = computed(() => buildingUnits.value.filter((u) => u.kind === 'parking'))
const storageUnits = computed(() => buildingUnits.value.filter((u) => u.kind === 'storage'))

// этажи общие для всех секций дома — рисуем их один раз слева и делим на все колонки
const floorsDesc = computed(() => [...new Set(livingUnits.value.map((u) => u.floor))].sort((a, b) => b - a))

const sections = computed(() => {
  const secs = [...new Set(livingUnits.value.map((u) => u.section))].sort((a, b) => a - b)
  return secs.map((section) => {
    const units = livingUnits.value.filter((u) => u.section === section)
    const sold = units.filter((u) => u.status === 'sold' || u.status === 'installment').length
    return {
      section, sold, total: units.length,
      byFloor: new Map(floorsDesc.value.map((floor) => [floor, units.filter((u) => u.floor === floor).sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }))])),
    }
  })
})

const cellBoxHeight = computed(() => (viewMode.value === 'large' ? 92 : 58))

const statusChips = computed(() => {
  const statuses: UnitStatus[] = ['free', 'reserved', 'installment', 'sold', 'closed']
  return statuses.map((status) => ({ status, meta: UNIT_STATUS_META[status], count: buildingUnits.value.filter((u) => u.status === status).length }))
})
const healthChips = computed(() => {
  const healths: PaymentHealth[] = ['ok', 'warn', 'bad']
  const inInstallment = buildingUnits.value.filter((u) => u.status === 'installment' && u.contractId)
  return healths.map((h) => ({
    health: h, meta: PAYMENT_HEALTH_META[h],
    count: inInstallment.filter((u) => healthFromBucket(dealsStore.paymentBoardBucket(u.contractId!)) === h).length,
  }))
})

function toggleStatusFilter(status: UnitStatus) {
  const i = filters.value.statuses.indexOf(status)
  if (i === -1) filters.value.statuses.push(status)
  else filters.value.statuses.splice(i, 1)
}

function openUnit(id: string) {
  activeUnitId.value = id
}

// подсветка объектов той же планировки при наведении — быстро сравнить похожие
const hoveredUnit = ref<Unit | null>(null)
const hoverPos = reactive({ x: 0, y: 0 })
function layoutKey(u: Unit) {
  return u.kind === 'apartment' ? `apartment-${u.rooms}` : u.kind
}
const hoveredKey = computed(() => (hoveredUnit.value ? layoutKey(hoveredUnit.value) : null))
function onHover(u: Unit, e: MouseEvent) {
  hoveredUnit.value = u
  hoverPos.x = e.clientX
  hoverPos.y = e.clientY
}
function onMove(e: MouseEvent) {
  hoverPos.x = e.clientX
  hoverPos.y = e.clientY
}
function onLeave() {
  hoveredUnit.value = null
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-[22px] font-semibold tracking-[-0.025em]">Шахматка</h1>
        <p class="mt-1 text-[13px] text-muted">Разрез дома по секциям и этажам — статус, цена и площадь в реальном времени</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <SegmentedControl
          v-if="viewMode !== 'list'" v-model="colorMode"
          :options="[{ value: 'status', label: 'Статус', icon: 'ph:tag' }, { value: 'payment', label: 'Оплата', icon: 'ph:hand-coins' }]"
        />
        <SegmentedControl
          v-model="viewMode"
          :options="[{ value: 'compact', label: 'Шахматка', icon: 'ph:grid-nine' }, { value: 'large', label: 'Шахматка+', icon: 'ph:squares-four' }, { value: 'list', label: 'Список', icon: 'ph:list-bullets' }]"
        />
        <div ref="filterPopoverRoot" class="relative">
          <AppButton icon="ph:sliders-horizontal" @click="filtersOpen = !filtersOpen">
            Фильтры
            <span v-if="rangeFilterCount" class="grid h-4 min-w-4 place-items-center rounded-full bg-fill-plum px-1 text-[10px] font-bold text-white">{{ rangeFilterCount }}</span>
          </AppButton>
          <Transition enter-active-class="animate-pop-in">
            <div v-if="filtersOpen" class="absolute right-0 top-11 z-30 w-[280px] rounded-card border border-line bg-panel p-4 shadow-panel">
              <UnitFilters v-model="filters" />
            </div>
          </Transition>
        </div>
      </div>
    </div>

    <div v-if="buildings.length" class="flex gap-1.5 overflow-x-auto border-b border-line pb-px">
      <button
        v-for="b in buildings" :key="b.id" type="button"
        class="focus-ring shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-[13.5px] font-semibold transition-colors"
        :class="activeBuildingId === b.id ? 'border-plum text-ink' : 'border-transparent text-muted hover:text-ink'"
        @click="activeBuildingId = b.id"
      >
        {{ b.name }}
      </button>
    </div>

    <!-- единая панель фильтр-чипов: тип помещения сверху, статус/оплата снизу — без дублей -->
    <div class="flex flex-col gap-2.5 rounded-xl2 bg-soft p-2.5">
      <div class="flex flex-wrap items-center gap-1.5">
        <Chip v-for="[key, meta] in kindOptions" :key="key" :pressed="filters.kinds.includes(key)" :icon="meta.icon" @click="toggleKind(key)">
          {{ meta.label }}
        </Chip>
        <button v-if="filters.kinds.length" type="button" class="ml-1 text-[12px] font-semibold text-plum hover:underline" @click="filters.kinds = []">
          Сбросить тип
        </button>
      </div>

      <div class="h-px bg-line" />

      <div class="flex flex-wrap items-center gap-1.5">
        <template v-if="colorMode === 'status' || viewMode === 'list'">
          <button
            v-for="c in statusChips" :key="c.status" type="button"
            class="focus-ring flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-colors"
            :class="filters.statuses.includes(c.status) ? 'bg-panel shadow-sm ring-1 ring-line' : 'text-muted hover:text-ink'"
            @click="toggleStatusFilter(c.status)"
          >
            <span class="h-2.5 w-2.5 rounded-full border" :class="[c.meta.boardBg, c.meta.boardBorder]" />
            {{ c.meta.label }} <b class="tabular text-ink">{{ c.count }}</b>
          </button>
        </template>
        <template v-else>
          <span v-for="c in healthChips" :key="c.health" class="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-muted">
            <span class="h-2.5 w-2.5 rounded-full" :class="c.meta.bg" />
            {{ c.meta.label }} <b class="tabular text-ink">{{ c.count }}</b>
          </span>
          <span class="ml-auto text-[11.5px] text-muted">Цвет = своевременность оплаты по договору в рассрочке</span>
        </template>
      </div>
    </div>

    <EmptyState v-if="!activeBuilding" icon="ph:building-apartment" title="Нет домов в проекте" text="Выберите другой проект или добавьте дом" />

    <UnitListTable
      v-else-if="viewMode === 'list'" :units="buildingUnits" :dim-ids="dimIds"
      @open="openUnit"
    />

    <template v-else>
      <!-- секции стоят в ряд и делят одну шкалу этажей слева — фасад дома в разрезе -->
      <div class="overflow-x-auto rounded-card border border-line bg-panel p-4 pb-5 shadow-card">
        <div class="inline-flex min-w-full flex-col">
          <div class="inline-flex items-start gap-6">
            <div class="flex shrink-0 flex-col">
              <div class="mb-2.5 h-[34px] border-b-2 border-ink/70" />
              <div
                v-for="floor in floorsDesc" :key="floor" class="mb-1.5 flex items-center justify-end pr-1 text-[11px] font-semibold text-muted last:mb-0"
                :style="{ height: `${cellBoxHeight}px` }"
              >
                {{ floor }}
              </div>
            </div>

            <div v-for="s in sections" :key="s.section" class="flex shrink-0 flex-col">
              <div class="mb-2.5 flex h-[34px] flex-col justify-end gap-0.5 border-b-2 border-ink/70 pb-1.5">
                <p class="text-[13px] font-semibold leading-none">Секция {{ s.section }}</p>
                <p class="text-[11px] leading-none text-muted">продано {{ s.sold }} из {{ s.total }}</p>
              </div>
              <div
                v-for="floor in floorsDesc" :key="floor" class="mb-1.5 flex items-center gap-1.5 last:mb-0"
                :style="{ height: `${cellBoxHeight}px` }"
              >
                <UnitCell
                  v-for="u in s.byFloor.get(floor) ?? []" :key="u.id" :unit="u" :large="viewMode === 'large'" :mode="colorMode"
                  :dim="dimIds.has(u.id)" :highlighted="hoveredKey === layoutKey(u)"
                  @click="openUnit(u.id)" @hover="onHover(u, $event)" @move="onMove" @leave="onLeave"
                />
              </div>
            </div>
          </div>

          <div v-if="parkingUnits.length || storageUnits.length" class="relative mb-2 mt-3 border-t-2 border-dashed border-ink/40">
            <span class="absolute right-0 top-1.5 text-[10.5px] font-medium text-muted">уровень земли ±0.000</span>
          </div>

          <div v-if="parkingUnits.length" class="mb-5 mt-4 flex items-start gap-2.5">
            <span class="w-7 shrink-0 pt-3 text-right text-[11px] font-semibold text-muted">−1</span>
            <div
              class="flex-1 rounded-card border border-dashed border-line p-3"
              :style="{ backgroundImage: 'repeating-linear-gradient(135deg, var(--soft) 0 8px, transparent 8px 16px)' }"
            >
              <p class="mb-2 text-[11.5px] text-muted">Паркинг · свободно {{ parkingUnits.filter((u) => u.status === 'free').length }} из {{ parkingUnits.length }}</p>
              <div class="flex flex-wrap gap-1.5">
                <UnitCell
                  v-for="u in parkingUnits" :key="u.id" :unit="u" :large="viewMode === 'large'" :mode="colorMode"
                  :dim="dimIds.has(u.id)" :highlighted="hoveredKey === layoutKey(u)"
                  @click="openUnit(u.id)" @hover="onHover(u, $event)" @move="onMove" @leave="onLeave"
                />
              </div>
            </div>
          </div>

          <div v-if="storageUnits.length" class="mb-1 flex items-start gap-2.5">
            <span class="w-7 shrink-0 pt-3 text-right text-[11px] font-semibold text-muted">−1</span>
            <div
              class="flex-1 rounded-card border border-dashed border-line p-3"
              :style="{ backgroundImage: 'repeating-linear-gradient(135deg, var(--soft) 0 8px, transparent 8px 16px)' }"
            >
              <p class="mb-2 text-[11.5px] text-muted">Кладовые · свободно {{ storageUnits.filter((u) => u.status === 'free').length }} из {{ storageUnits.length }}</p>
              <div class="flex flex-wrap gap-1.5">
                <UnitCell
                  v-for="u in storageUnits" :key="u.id" :unit="u" :large="viewMode === 'large'" :mode="colorMode"
                  :dim="dimIds.has(u.id)" :highlighted="hoveredKey === layoutKey(u)"
                  @click="openUnit(u.id)" @hover="onHover(u, $event)" @move="onMove" @leave="onLeave"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <UnitTooltip :unit="hoveredUnit" :x="hoverPos.x" :y="hoverPos.y" />
    <UnitDrawer :unit-id="activeUnitId" @close="activeUnitId = null" @navigate="activeUnitId = $event" />
  </div>
</template>
