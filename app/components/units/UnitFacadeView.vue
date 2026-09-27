<script setup lang="ts">
import type { Building, Unit } from '~/types/models'
import type { MatchedUnit } from '~/composables/useLeadMatching'
import type { ZoneMark } from '~/components/units/UnitZoneCanvas.vue'
import { facadeMarkupStats, facadeUnitZones } from '~/utils/facade'
import { FACADE_TAG_META, UNIT_BOARD_COLOR, UNIT_STATUS_META } from '~/utils/meta'
import { area as fmtArea, money, moneyCompact } from '~/utils/format'

/**
 * Интерактивный фасад. Квартира на фасаде — тот же объект, что в шахматке:
 * цвет по статусу, клик открывает карточку, Ctrl+клик выделяет, выделение
 * общее со всеми остальными представлениями подбора.
 */
const props = withDefaults(defineProps<{
  scopeKey: string
  building: Building
  units: Unit[]
  /** прошедшие фильтр — остальные гасим, но не убираем: фасад должен читаться целиком */
  matchIds: Set<string>
  scores?: Map<string, MatchedUnit>
  /** подсказка при наведении; гасим, пока открыта мини-карточка */
  tooltip?: boolean
}>(), { tooltip: true })
const emit = defineEmits<{ open: [string] }>()

const board = useBoardStore()
const unitsStore = useUnitsStore()
const scope = computed(() => board.scope(props.scopeKey))

const facades = computed(() => props.building.facades.filter((f) => f.imageUrl))

watchEffect(() => {
  if (!facades.value.length) return
  if (!facades.value.some((f) => f.id === scope.value.facadeId)) {
    board.setFacade(props.scopeKey, facades.value[0]!.id)
  }
})

const facade = computed(() => facades.value.find((f) => f.id === scope.value.facadeId))
const zones = computed(() => facadeUnitZones({
  facade: facade.value,
  floors: props.building.floors,
  units: props.units,
}))
const stats = computed(() => facadeMarkupStats(facade.value, props.units.filter((u) => u.floor >= 1).length))

const unitById = computed(() => new Map(props.units.map((u) => [u.id, u])))
const selected = computed(() => new Set(scope.value.selected))

const marks = computed<ZoneMark[]>(() => zones.value.flatMap((z) => {
  const unit = unitById.value.get(z.unitId)
  if (!unit) return []
  const score = props.scores?.get(unit.id)
  return [{
    id: unit.id,
    polygon: z.polygon,
    color: UNIT_BOARD_COLOR[unit.status],
    label: unit.number,
    sublabel: moneyCompact(unit.price),
    selected: selected.value.has(unit.id),
    dim: !props.matchIds.has(unit.id),
    derived: z.derived,
    badge: score ? `${score.score}%` : undefined,
  }]
}))

const statusLegend = computed(() => {
  const counts = new Map<string, number>()
  for (const u of props.units) {
    if (!props.matchIds.has(u.id)) continue
    counts.set(u.status, (counts.get(u.status) ?? 0) + 1)
  }
  return (['free', 'reserved', 'installment', 'sold', 'closed'] as const)
    .filter((s) => counts.get(s))
    .map((s) => ({ status: s, label: UNIT_STATUS_META[s].label, color: UNIT_BOARD_COLOR[s], count: counts.get(s) ?? 0 }))
})

function tipUnit(id: string) {
  return unitById.value.get(id)
}
/** Сколько человек ждёт этот объект — на фасаде это главный сигнал срочности. */
function queueOf(id: string) {
  return unitsStore.queueFor(id).length
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- ракурсы -->
    <div v-if="facades.length > 1" class="flex flex-wrap gap-1.5">
      <Chip
        v-for="f in facades" :key="f.id" :pressed="scope.facadeId === f.id" :icon="FACADE_TAG_META[f.tag].icon"
        @click="board.setFacade(scopeKey, f.id)"
      >{{ f.name }}</Chip>
    </div>

    <template v-if="facade?.imageUrl">
      <UnitZoneCanvas
        :image-url="facade.imageUrl" :marks="marks" :tooltip="tooltip"
        @pick="emit('open', $event)" @toggle="board.toggleSelect(scopeKey, $event)"
      >
        <template #tip="{ mark }">
          <template v-if="tipUnit(mark.id)">
            <p class="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
              <span class="h-2 w-2 shrink-0 rounded-full" :style="{ background: mark.color }" />
              № {{ tipUnit(mark.id)!.number }}
              <StatusTag :tone="UNIT_STATUS_META[tipUnit(mark.id)!.status].tone" size="sm" class="ml-auto">
                {{ UNIT_STATUS_META[tipUnit(mark.id)!.status].label }}
              </StatusTag>
            </p>
            <dl class="mt-1.5 flex flex-col gap-0.5 text-[11.5px]">
              <div class="flex justify-between"><dt class="text-muted">Этаж</dt><dd class="tabular font-medium">{{ tipUnit(mark.id)!.floor }}</dd></div>
              <div class="flex justify-between"><dt class="text-muted">Комнат</dt><dd class="tabular font-medium">{{ tipUnit(mark.id)!.rooms || '—' }}</dd></div>
              <div class="flex justify-between"><dt class="text-muted">Площадь</dt><dd class="tabular font-medium">{{ fmtArea(tipUnit(mark.id)!.area) }}</dd></div>
              <div class="flex justify-between"><dt class="text-muted">Цена</dt><dd class="tabular font-semibold">{{ money(tipUnit(mark.id)!.price) }}</dd></div>
              <div v-if="queueOf(mark.id)" class="flex justify-between text-warn">
                <dt>В очереди</dt><dd class="tabular font-semibold">{{ queueOf(mark.id) }}</dd>
              </div>
              <div v-if="scores?.get(mark.id)" class="mt-0.5 flex justify-between border-t border-line pt-0.5">
                <dt class="text-muted">Совпадение</dt>
                <dd class="tabular font-bold text-plum">{{ scores!.get(mark.id)!.score }}%</dd>
              </div>
            </dl>
          </template>
        </template>
      </UnitZoneCanvas>

      <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div class="flex flex-wrap items-center gap-2.5">
          <span v-for="l in statusLegend" :key="l.status" class="flex items-center gap-1.5 text-[11.5px] text-muted">
            <span class="h-2.5 w-2.5 rounded-sm" :style="{ background: l.color }" />
            {{ l.label }} <b class="tabular text-ink">{{ l.count }}</b>
          </span>
        </div>
        <p v-if="stats.derived" class="ml-auto flex items-center gap-1.5 text-[11.5px] text-muted">
          <Icon name="ph:dashed-line" size="14" />
          Пунктир — авторазметка по полосе этажа ({{ stats.derived }} из {{ stats.total }})
          <NuxtLink
            :to="`/facades/${building.id}/${facade.id}`"
            class="font-semibold text-plum hover:underline"
          >уточнить</NuxtLink>
        </p>
      </div>
    </template>

    <EmptyState
      v-else compact icon="ph:building-apartment" title="Фасад не загружен"
      text="Загрузите фото или рендер дома в карточке дома — после этого квартиры появятся на фасаде"
    >
      <template #action>
        <AppButton size="sm" icon="ph:arrow-right" @click="navigateTo(`/buildings/${building.id}?tab=facade`)">К фасадам дома</AppButton>
      </template>
    </EmptyState>
  </div>
</template>
