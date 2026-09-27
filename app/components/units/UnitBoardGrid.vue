<script setup lang="ts">
import type { Unit } from '~/types/models'
import type { MatchedUnit } from '~/composables/useLeadMatching'

/**
 * Сетка шахматки: секции в ряд, общая шкала этажей слева, паркинг и кладовые
 * под уровнем земли. Вынесена из страницы, потому что тот же разрез нужен в
 * карточке заявки и в мастере сделок.
 */
const props = withDefaults(defineProps<{
  scopeKey: string
  units: Unit[]
  matchIds: Set<string>
  scores?: Map<string, MatchedUnit>
  /** подсказка при наведении; гасим, пока открыта мини-карточка */
  tooltip?: boolean
}>(), { tooltip: true })
const emit = defineEmits<{ open: [string] }>()

const board = useBoardStore()
const unitsStore = useUnitsStore()
const scope = computed(() => board.scope(props.scopeKey))

/** Очередь на объект — на ячейке это знак «спрос есть, торопись». */
function queueOf(unitId: string) {
  return unitsStore.queueFor(unitId).length
}
const large = computed(() => scope.value.cellSize === 'large')
const selected = computed(() => new Set(scope.value.selected))

const living = computed(() => props.units.filter((u) => u.floor >= 1 && u.kind !== 'parking' && u.kind !== 'storage'))
const parking = computed(() => props.units.filter((u) => u.kind === 'parking'))
const storage = computed(() => props.units.filter((u) => u.kind === 'storage'))

// этажи общие для всех секций дома — рисуем их один раз слева
const floorsDesc = computed(() => [...new Set(living.value.map((u) => u.floor))].sort((a, b) => b - a))

const sections = computed(() => {
  const secs = [...new Set(living.value.map((u) => u.section))].sort((a, b) => a - b)
  return secs.map((section) => {
    const units = living.value.filter((u) => u.section === section)
    const sold = units.filter((u) => u.status === 'sold' || u.status === 'installment').length
    return {
      section,
      sold,
      total: units.length,
      byFloor: new Map(floorsDesc.value.map((floor) => [
        floor,
        units.filter((u) => u.floor === floor).sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true })),
      ])),
    }
  })
})

const cellBoxHeight = computed(() => (large.value ? 92 : 58))

/* ------------------------- массовое выделение --------------------------- */

function idsOf(units: Unit[]) {
  return units.filter((u) => props.matchIds.has(u.id)).map((u) => u.id)
}
/** Выделить/снять этаж или секцию целиком — по клику на её заголовок. */
function toggleGroup(units: Unit[]) {
  const ids = idsOf(units)
  if (!ids.length) return
  const allSelected = ids.every((id) => selected.value.has(id))
  if (allSelected) ids.forEach((id) => board.deselect(props.scopeKey, id))
  else board.selectMany(props.scopeKey, ids)
}
function floorUnits(floor: number) {
  return living.value.filter((u) => u.floor === floor)
}

function onCellClick(unit: Unit, e: MouseEvent) {
  if (e.metaKey || e.ctrlKey || e.shiftKey) board.toggleSelect(props.scopeKey, unit.id)
  else emit('open', unit.id)
}

/* ---------------------------- подсветка типа ---------------------------- */

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
</script>

<template>
  <div class="overflow-x-auto rounded-card border border-line bg-panel p-4 pb-5 shadow-card">
    <div class="inline-flex min-w-full flex-col">
      <div class="inline-flex items-start gap-6">
        <div class="flex shrink-0 flex-col">
          <div class="mb-2.5 h-[34px] border-b-2 border-ink/70" />
          <button
            v-for="f in floorsDesc" :key="f" type="button"
            class="focus-ring mb-1.5 flex items-center justify-end pr-1 text-[11px] font-semibold text-muted transition-colors last:mb-0 hover:text-plum"
            :style="{ height: `${cellBoxHeight}px` }"
            :title="`Выделить этаж ${f}`"
            @click="toggleGroup(floorUnits(f))"
          >{{ f }}</button>
        </div>

        <div v-for="s in sections" :key="s.section" class="flex shrink-0 flex-col">
          <button
            type="button"
            class="focus-ring mb-2.5 flex h-[34px] flex-col justify-end gap-0.5 border-b-2 border-ink/70 pb-1.5 text-left transition-colors hover:text-plum"
            :title="`Выделить секцию ${s.section}`"
            @click="toggleGroup(living.filter((u) => u.section === s.section))"
          >
            <p class="text-[13px] font-semibold leading-none">Секция {{ s.section }}</p>
            <p class="text-[11px] leading-none text-muted">продано {{ s.sold }} из {{ s.total }}</p>
          </button>
          <div
            v-for="f in floorsDesc" :key="f" class="mb-1.5 flex items-center gap-1.5 last:mb-0"
            :style="{ height: `${cellBoxHeight}px` }"
          >
            <UnitCell
              v-for="u in s.byFloor.get(f) ?? []" :key="u.id" :unit="u" :large="large" :mode="scope.colorMode"
              :dim="!matchIds.has(u.id)" :highlighted="hoveredKey === layoutKey(u)"
              :selected="selected.has(u.id)" :score="scores?.get(u.id)?.score" :queue="queueOf(u.id)"
              @click="onCellClick(u, $event)" @hover="onHover(u, $event)" @move="onMove" @leave="hoveredUnit = null"
            />
          </div>
        </div>
      </div>

      <div v-if="parking.length || storage.length" class="relative mb-2 mt-3 border-t-2 border-dashed border-ink/40">
        <span class="absolute right-0 top-1.5 text-[10.5px] font-medium text-muted">уровень земли ±0.000</span>
      </div>

      <div
        v-for="group in [
          { key: 'parking', label: 'Паркинг', list: parking },
          { key: 'storage', label: 'Кладовые', list: storage },
        ].filter((g) => g.list.length)" :key="group.key"
        class="mb-4 mt-4 flex items-start gap-2.5 last:mb-1"
      >
        <span class="w-7 shrink-0 pt-3 text-right text-[11px] font-semibold text-muted">−1</span>
        <div
          class="flex-1 rounded-card border border-dashed border-line p-3"
          :style="{ backgroundImage: 'repeating-linear-gradient(135deg, var(--soft) 0 8px, transparent 8px 16px)' }"
        >
          <p class="mb-2 text-[11.5px] text-muted">
            {{ group.label }} · свободно {{ group.list.filter((u) => u.status === 'free').length }} из {{ group.list.length }}
          </p>
          <div class="flex flex-wrap gap-1.5">
            <UnitCell
              v-for="u in group.list" :key="u.id" :unit="u" :large="large" :mode="scope.colorMode"
              :dim="!matchIds.has(u.id)" :highlighted="hoveredKey === layoutKey(u)"
              :selected="selected.has(u.id)" :score="scores?.get(u.id)?.score" :queue="queueOf(u.id)"
              @click="onCellClick(u, $event)" @hover="onHover(u, $event)" @move="onMove" @leave="hoveredUnit = null"
            />
          </div>
        </div>
      </div>
    </div>

    <UnitTooltip
      :unit="tooltip ? hoveredUnit : null" :x="hoverPos.x" :y="hoverPos.y"
      :score="hoveredUnit ? scores?.get(hoveredUnit.id) : undefined"
    />
  </div>
</template>
