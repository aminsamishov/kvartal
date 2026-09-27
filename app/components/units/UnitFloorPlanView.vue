<script setup lang="ts">
import type { Building, Unit, ZonePoint } from '~/types/models'
import type { MatchedUnit } from '~/composables/useLeadMatching'
import type { ZoneMark } from '~/components/units/UnitZoneCanvas.vue'
import { UNIT_BOARD_COLOR, UNIT_STATUS_META } from '~/utils/meta'
import { area as fmtArea, money, moneyCompact } from '~/utils/format'
import { explicationTotals, roomLabel } from '~/utils/explication'

/**
 * План этажа как рабочий инструмент: переключение этажей, масштаб, экспликация
 * выбранной квартиры рядом с чертежом. Выделение общее с шахматкой и фасадом.
 */
const props = withDefaults(defineProps<{
  scopeKey: string
  building: Building
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

const floors = computed(() => [...new Set(props.units.filter((u) => u.floor >= 1).map((u) => u.floor))].sort((a, b) => b - a))

// этаж по умолчанию: где есть совпадения по фильтру, иначе верхний
watchEffect(() => {
  if (!floors.value.length) return
  if (scope.value.floor !== null && floors.value.includes(scope.value.floor)) return
  const withMatch = floors.value.find((f) => props.units.some((u) => u.floor === f && props.matchIds.has(u.id)))
  board.setFloor(props.scopeKey, withMatch ?? floors.value[0]!)
})

const floor = computed(() => scope.value.floor ?? floors.value[0] ?? 1)
const plan = computed(() => props.building.floorPlans.find((f) => f.floor === floor.value))
const floorUnits = computed(() => props.units
  .filter((u) => u.floor === floor.value)
  .sort((a, b) => a.section - b.section || a.number.localeCompare(b.number, undefined, { numeric: true })))

const unitById = computed(() => new Map(props.units.map((u) => [u.id, u])))
const selected = computed(() => new Set(scope.value.selected))

/** Прямоугольник хранится двумя углами — на полотно отдаём четыре точки. */
function polygonOf(zone: { shape: 'rect' | 'poly'; points: ZonePoint[] }): ZonePoint[] {
  if (zone.shape === 'poly') return zone.points
  const [a, b] = zone.points
  if (!a || !b) return []
  const x0 = Math.min(a.x, b.x); const x1 = Math.max(a.x, b.x)
  const y0 = Math.min(a.y, b.y); const y1 = Math.max(a.y, b.y)
  return [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }]
}

const marks = computed<ZoneMark[]>(() => (plan.value?.zones ?? []).flatMap((z) => {
  const unit = unitById.value.get(z.refId)
  const polygon = polygonOf(z)
  if (!unit || polygon.length < 3) return []
  const score = props.scores?.get(unit.id)
  return [{
    id: unit.id,
    polygon,
    color: UNIT_BOARD_COLOR[unit.status],
    label: `№ ${unit.number}`,
    sublabel: `${unit.rooms || '—'}к · ${moneyCompact(unit.price)}`,
    selected: selected.value.has(unit.id),
    dim: !props.matchIds.has(unit.id),
    badge: score ? `${score.score}%` : undefined,
  }]
}))

const markedIds = computed(() => new Set(marks.value.map((m) => m.id)))
const unmarked = computed(() => floorUnits.value.filter((u) => !markedIds.value.has(u.id)))

/* ------------------------------- экспликация ------------------------------- */

const hoverId = ref<string | null>(null)
// показываем ведомость последней затронутой квартиры: сначала наведение,
// затем выделение — иначе панель мигает пустотой при каждом уходе курсора
const detailId = computed(() => hoverId.value
  ?? scope.value.selected.find((id) => floorUnits.value.some((u) => u.id === id))
  ?? floorUnits.value.find((u) => props.matchIds.has(u.id))?.id
  ?? null)
const detailUnit = computed(() => (detailId.value ? unitById.value.get(detailId.value) : undefined))
const explication = computed(() => (detailId.value ? unitsStore.explicationFor(detailId.value) : { rooms: [], own: false }))
const totals = computed(() => explicationTotals(explication.value.rooms))

const floorStats = computed(() => {
  const free = floorUnits.value.filter((u) => u.status === 'free').length
  return { total: floorUnits.value.length, free, marked: markedIds.value.size }
})
</script>

<template>
  <div class="flex flex-col gap-3 xl:flex-row">
    <!-- шкала этажей -->
    <div class="flex shrink-0 gap-1.5 overflow-x-auto xl:max-h-[62vh] xl:w-[64px] xl:flex-col xl:overflow-y-auto">
      <button
        v-for="f in floors" :key="f" type="button"
        class="focus-ring flex shrink-0 items-center justify-between gap-1.5 rounded-lg border px-2 py-1.5 text-[12px] font-semibold transition-colors xl:w-full"
        :class="f === floor
          ? 'border-ink bg-ink text-panel'
          : units.some((u) => u.floor === f && matchIds.has(u.id))
            ? 'border-line bg-panel text-ink hover:bg-soft'
            : 'border-dashed border-line text-muted hover:text-ink'"
        :title="`Этаж ${f}`"
        @click="board.setFloor(scopeKey, f)"
      >
        <span class="tabular">{{ f }}</span>
        <span
          v-if="building.floorPlans.some((p) => p.floor === f && p.imageUrl && p.zones.length)"
          class="h-1.5 w-1.5 shrink-0 rounded-full bg-ok" title="План размечен"
        />
      </button>
    </div>

    <!-- чертёж -->
    <div class="min-w-0 flex-1">
      <template v-if="plan?.imageUrl">
        <UnitZoneCanvas
          :image-url="plan.imageUrl" :marks="marks" :highlight-id="hoverId" :tooltip="tooltip"
          @pick="emit('open', $event)" @toggle="board.toggleSelect(scopeKey, $event)" @hover="hoverId = $event"
        >
          <template #actions>
            <span class="text-[11.5px] text-muted">
              {{ plan.name }} · {{ floorStats.total }} помещ., свободно <b class="text-ink">{{ floorStats.free }}</b>
            </span>
          </template>
        </UnitZoneCanvas>

        <div v-if="unmarked.length" class="mt-2 rounded-xl2 border border-dashed border-line p-2.5">
          <p class="mb-1.5 flex items-center gap-1.5 text-[11.5px] text-muted">
            <Icon name="ph:polygon" size="13" />
            Не размечено на плане: {{ unmarked.length }} — откройте карточку из списка
            <NuxtLink :to="`/buildings/${building.id}?tab=floorplans`" class="font-semibold text-plum hover:underline">разметить</NuxtLink>
          </p>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="u in unmarked" :key="u.id" type="button"
              class="focus-ring rounded-full border px-2 py-0.5 text-[11.5px] font-medium transition-colors"
              :class="matchIds.has(u.id) ? 'border-line text-ink hover:bg-soft' : 'border-line text-muted opacity-50'"
              @click="emit('open', u.id)"
            >№ {{ u.number }}</button>
          </div>
        </div>
      </template>

      <EmptyState
        v-else compact icon="ph:stack" :title="`План ${floor} этажа не загружен`"
        text="Планы этажей загружаются в карточке дома — после этого покупатель видит расположение квартиры"
      >
        <template #action>
          <AppButton size="sm" icon="ph:arrow-right" @click="navigateTo(`/buildings/${building.id}?tab=floorplans`)">К планам этажей</AppButton>
        </template>
      </EmptyState>
    </div>

    <!-- экспликация -->
    <aside class="shrink-0 xl:w-[248px]">
      <div v-if="detailUnit" class="rounded-card border border-line bg-panel p-3 shadow-card">
        <div class="flex items-center justify-between gap-2">
          <p class="tabular text-[14px] font-semibold text-ink">№ {{ detailUnit.number }}</p>
          <StatusTag :tone="UNIT_STATUS_META[detailUnit.status].tone" size="sm" dot>{{ UNIT_STATUS_META[detailUnit.status].label }}</StatusTag>
        </div>
        <p class="mt-0.5 text-[11.5px] text-muted">
          {{ detailUnit.rooms || '—' }} комн. · {{ fmtArea(detailUnit.area) }} · секция {{ detailUnit.section || '—' }}
        </p>
        <p class="tabular mt-1 text-[15px] font-semibold text-ink">{{ money(detailUnit.price) }}</p>

        <div v-if="explication.rooms.length" class="mt-2.5 overflow-hidden rounded-lg border border-line">
          <table class="w-full border-collapse text-[11.5px]">
            <tbody>
              <tr v-for="r in explication.rooms" :key="r.id" class="border-b border-line last:border-0">
                <td class="px-2 py-1 text-muted">{{ roomLabel(r) }}</td>
                <td class="tabular px-2 py-1 text-right font-semibold">{{ r.area }}</td>
              </tr>
              <tr class="bg-soft">
                <td class="px-2 py-1 font-semibold">Итого</td>
                <td class="tabular px-2 py-1 text-right font-bold">{{ totals.total }} м²</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="mt-2 text-[11.5px] text-muted">Экспликация не заполнена</p>

        <div class="mt-2.5 flex gap-1.5">
          <AppButton size="sm" block icon="ph:arrow-square-out" @click="emit('open', detailUnit.id)">Карточка</AppButton>
          <button
            type="button"
            class="focus-ring grid h-8 w-8 shrink-0 place-items-center rounded-xl2 border transition-colors"
            :class="selected.has(detailUnit.id) ? 'border-ink bg-ink text-panel' : 'border-line text-muted hover:text-ink'"
            title="Выделить" @click="board.toggleSelect(scopeKey, detailUnit.id)"
          ><Icon name="ph:check-square" size="15" /></button>
        </div>
      </div>
      <p v-else class="rounded-card border border-dashed border-line px-3 py-2.5 text-[11.5px] text-muted">
        Наведите курсор на помещение — покажем экспликацию
      </p>
    </aside>
  </div>
</template>
