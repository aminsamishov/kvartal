<script setup lang="ts">
import type { Unit, UnitKind, UnitStatus } from '~/types/models'
import { UNIT_KIND_META, UNIT_STATUS_META } from '~/utils/meta'
import {
  activeFilterCount, clearFilterGroup, describeFilters, emptyUnitFilters,
  type UnitFilterState,
} from '~/utils/unitFilters'

/**
 * Панель фильтров подбора. Одна на все четыре представления: выбранный фильтр
 * применяется сразу и к шахматке, и к фасаду, и к плану этажа, и к списку.
 */
const props = defineProps<{
  /** весь фонд представления — по нему считаются счётчики у чипов */
  units: Unit[]
  /** прошедшие фильтр — число в шапке */
  matched: number
}>()
const filters = defineModel<UnitFilterState>({ required: true })

const popoverRoot = ref<HTMLElement | null>(null)
const open = ref(false)
onClickOutside(popoverRoot, () => (open.value = false))

const STATUSES: UnitStatus[] = ['free', 'reserved', 'installment', 'sold', 'closed']

const statusChips = computed(() => STATUSES
  .map((status) => ({ status, meta: UNIT_STATUS_META[status], count: props.units.filter((u) => u.status === status).length }))
  .filter((c) => c.count))

const kindChips = computed(() => {
  const present = new Set(props.units.map((u) => u.kind))
  return (Object.entries(UNIT_KIND_META) as [UnitKind, typeof UNIT_KIND_META[UnitKind]][])
    .filter(([key]) => present.has(key))
})

const roomChips = computed(() => [...new Set(props.units.filter((u) => u.rooms > 0).map((u) => u.rooms))].sort((a, b) => a - b))

const sections = computed(() => [...new Set(props.units.map((u) => u.section))].filter(Boolean).sort((a, b) => a - b))
const floors = computed(() => {
  const list = props.units.filter((u) => u.floor >= 1).map((u) => u.floor)
  return list.length ? { min: Math.min(...list), max: Math.max(...list) } : undefined
})

function toggleStatus(status: UnitStatus) {
  const list = filters.value.statuses
  filters.value = { ...filters.value, statuses: list.includes(status) ? list.filter((s) => s !== status) : [...list, status] }
}
function toggleKind(kind: UnitKind) {
  const list = filters.value.kinds
  filters.value = { ...filters.value, kinds: list.includes(kind) ? list.filter((k) => k !== kind) : [...list, kind] }
}
/** Быстрый выбор комнатности: чип задаёт вилку «ровно столько». */
function toggleRooms(rooms: number) {
  const exact = filters.value.roomsMin === String(rooms) && filters.value.roomsMax === String(rooms)
  filters.value = { ...filters.value, roomsMin: exact ? '' : String(rooms), roomsMax: exact ? '' : String(rooms) }
}
function roomsPressed(rooms: number) {
  return filters.value.roomsMin === String(rooms) && filters.value.roomsMax === String(rooms)
}

const extraCount = computed(() => {
  const f = filters.value
  let n = 0
  if (f.areaMin || f.areaMax) n++
  if (f.priceMin || f.priceMax) n++
  if (f.floorMin || f.floorMax) n++
  if (f.sections.length) n++
  if (f.finishing.length) n++
  if (f.onlyAvailable) n++
  return n
})
const totalCount = computed(() => activeFilterCount(filters.value))
const chips = computed(() => describeFilters(filters.value))

function reset() {
  filters.value = emptyUnitFilters()
}
</script>

<template>
  <div class="flex flex-col gap-2.5">
    <div class="flex flex-wrap items-center gap-2">
      <AppInput
        :model-value="filters.search" placeholder="Номер помещения" icon="ph:magnifying-glass" class="w-[190px]"
        @update:model-value="filters = { ...filters, search: $event }"
      />

      <div class="flex flex-wrap items-center gap-1.5">
        <button
          v-for="c in statusChips" :key="c.status" type="button"
          class="focus-ring flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition-colors"
          :class="filters.statuses.includes(c.status) ? 'border-ink bg-ink text-panel' : 'border-line bg-panel text-muted hover:text-ink'"
          @click="toggleStatus(c.status)"
        >
          <span class="h-2.5 w-2.5 rounded-full border" :class="[c.meta.boardBg, c.meta.boardBorder]" />
          {{ c.meta.label }}
          <b class="tabular" :class="filters.statuses.includes(c.status) ? 'text-panel' : 'text-ink'">{{ c.count }}</b>
        </button>
      </div>

      <span class="h-5 w-px bg-line" />

      <div class="flex flex-wrap items-center gap-1.5">
        <Chip v-for="r in roomChips" :key="r" :pressed="roomsPressed(r)" @click="toggleRooms(r)">{{ r }} комн.</Chip>
      </div>

      <div ref="popoverRoot" class="relative ml-auto">
        <AppButton icon="ph:sliders-horizontal" @click="open = !open">
          Фильтры
          <span v-if="extraCount" class="grid h-4 min-w-4 place-items-center rounded-full bg-fill-plum px-1 text-[10px] font-bold text-white">{{ extraCount }}</span>
        </AppButton>
        <Transition enter-active-class="animate-pop-in">
          <div v-if="open" class="absolute right-0 top-11 z-30 w-[300px] rounded-card border border-line bg-panel p-4 shadow-panel">
            <div v-if="kindChips.length > 1" class="mb-4">
              <p class="mb-2 text-[12.5px] font-semibold">Тип помещения</p>
              <div class="flex flex-wrap gap-1.5">
                <Chip v-for="[key, meta] in kindChips" :key="key" :pressed="filters.kinds.includes(key)" :icon="meta.icon" @click="toggleKind(key)">
                  {{ meta.label }}
                </Chip>
              </div>
            </div>
            <UnitFilters v-model="filters" :sections="sections" :floors="floors" />
          </div>
        </Transition>
      </div>
    </div>

    <!-- что именно сузили -->
    <div v-if="chips.length || totalCount" class="flex flex-wrap items-center gap-1.5">
      <span class="text-[11.5px] text-muted">Найдено <b class="tabular text-ink">{{ matched }}</b> из {{ units.length }}</span>
      <button
        v-for="c in chips" :key="c.key" type="button"
        class="focus-ring flex items-center gap-1 rounded-full border border-line bg-panel px-2 py-0.5 text-[11.5px] font-medium text-ink hover:border-bad hover:text-bad"
        title="Убрать условие"
        @click="filters = clearFilterGroup(filters, c.key)"
      >
        {{ c.label }} <Icon name="ph:x" size="10" />
      </button>
      <button v-if="totalCount" type="button" class="text-[11.5px] font-semibold text-muted hover:text-bad" @click="reset">
        Сбросить всё
      </button>
    </div>
  </div>
</template>
