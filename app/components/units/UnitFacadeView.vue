<script setup lang="ts">
import type { Building, Unit } from '~/types/models'
import type { MatchedUnit } from '~/composables/useLeadMatching'
import type { ZoneMark } from '~/components/units/UnitZoneCanvas.vue'
import { blockSummary, blockTone, facadeBlockZones, facadeMarkupStats, facadeUnitZones } from '~/utils/facade'
import { FACADE_TAG_META, UNIT_BOARD_COLOR, UNIT_STATUS_META } from '~/utils/meta'
import { area as fmtArea, money, moneyCompact } from '~/utils/format'

/**
 * Интерактивный фасад. Квартира на фасаде — тот же объект, что в шахматке:
 * цвет по статусу, клик открывает карточку, Ctrl+клик выделяет, выделение
 * общее со всеми остальными представлениями подбора.
 *
 * Два режима. В «Продаже» на экране только то, что показывают клиенту:
 * статусы, цены, проценты совпадения. Технические слои — пунктир авторазметки,
 * покрытие этажей, ссылки в редактор — живут в «Редакторе» и менеджеру во время
 * разговора не мешают.
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
  /** доступен ли режим разметки: в карточке заявки он ни к чему */
  canEdit?: boolean
}>(), { tooltip: true, canEdit: false })
const emit = defineEmits<{
  open: [string]
  /** клик по блоку: показываем клиенту этаж — план, планировки и цены */
  block: [{ floor: number; section: number }]
}>()

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

/** Без права правки разметки режим всегда «Продажа» — выбирать нечего. */
const mode = computed(() => (props.canEdit ? scope.value.facadeMode : 'sale'))
const MODES = [
  { value: 'sale', label: 'Продажа', icon: 'ph:handshake' },
  { value: 'edit', label: 'Редактор', icon: 'ph:polygon' },
]
const zones = computed(() => facadeUnitZones({
  facade: facade.value,
  floors: props.building.floors,
  units: props.units,
}))

/**
 * В продаже фасад размечен блоками «подъезд × этаж»: клиенту на рендере не
 * нужны контуры каждого окна, ему нужно увидеть, где подъезд, где этаж и что
 * там есть. Поквартирные контуры остаются в редакторе — это техника.
 */
const blocks = computed(() => facadeBlockZones({
  facade: facade.value,
  floors: props.building.floors,
  units: props.units,
}))

const blockInfo = computed(() => {
  const map = new Map<string, ReturnType<typeof blockSummary>>()
  const byId = new Map(props.units.map((u) => [u.id, u]))
  for (const b of blocks.value) {
    map.set(b.key, blockSummary(b.unitIds.map((id) => byId.get(id)).filter((u): u is Unit => !!u)))
  }
  return map
})

const blockMarks = computed<ZoneMark[]>(() => blocks.value.map((b) => {
  const info = blockInfo.value.get(b.key)!
  const tone = blockTone(info)
  const matched = b.unitIds.some((id) => props.matchIds.has(id))
  return {
    id: b.key,
    polygon: b.polygon,
    color: tone.color,
    // на рендере — только число свободных; цена и разбор по типам живут в подсказке
    label: info.free ? String(info.free) : '—',
    sublabel: info.minPrice ? `от ${moneyCompact(info.minPrice)}` : undefined,
    dim: !matched,
  }
}))

function blockAt(key: string) {
  const zone = blocks.value.find((b) => b.key === key)
  const info = blockInfo.value.get(key)
  return zone && info ? { zone, info, tone: blockTone(info) } : null
}

function onBlockPick(key: string) {
  const zone = blocks.value.find((b) => b.key === key)
  if (zone) emit('block', { floor: zone.floor, section: zone.section })
}
const stats = computed(() => facadeMarkupStats(facade.value, props.units.filter((u) => u.floor >= 1).length))

const unitById = computed(() => new Map(props.units.map((u) => [u.id, u])))
const ROOM_LABEL: Record<number, string> = { 0: 'Студия/коммерция', 1: '1-комнатные', 2: '2-комнатные', 3: '3-комнатные', 4: '4-комнатные' }
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
    // пунктир — служебная пометка «контур выведен автоматически»; в продаже он
    // выглядит как дефект фасада, поэтому остаётся только в редакторе
    derived: mode.value === 'edit' ? z.derived : false,
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

/** «От» и «до» по свободным квартирам ракурса — первый вопрос покупателя. */
const priceRange = computed(() => {
  const prices = props.units
    .filter((u) => u.status === 'free' && u.kind === 'apartment' && props.matchIds.has(u.id))
    .map((u) => u.price)
  if (!prices.length) return null
  return { min: Math.min(...prices), max: Math.max(...prices) }
})
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- ракурсы и режим работы -->
    <div class="flex flex-wrap items-center gap-1.5">
      <template v-if="facades.length > 1">
        <Chip
          v-for="f in facades" :key="f.id" :pressed="scope.facadeId === f.id" :icon="FACADE_TAG_META[f.tag].icon"
          @click="board.setFacade(scopeKey, f.id)"
        >{{ f.name }}</Chip>
      </template>
      <SegmentedControl
        v-if="canEdit" :model-value="mode" class="ml-auto shrink-0" :options="MODES"
        @update:model-value="board.setFacadeMode(scopeKey, $event as 'sale' | 'edit')"
      />
    </div>

    <template v-if="facade?.imageUrl">
      <!-- продажа: блоки «подъезд × этаж», клик открывает этаж клиенту -->
      <UnitZoneCanvas
        v-if="mode === 'sale'"
        :image-url="facade.imageUrl" :marks="blockMarks" :tooltip="tooltip" soft
        @pick="onBlockPick" @toggle="onBlockPick"
      >
        <template #actions>
          <span class="hidden items-center gap-1.5 text-[11.5px] text-muted sm:flex">
            <Icon name="ph:cursor-click" size="13" /> Клик по этажу — планировки и цены
          </span>
        </template>
        <template #tip="{ mark }">
          <template v-if="blockAt(mark.id)">
            <p class="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
              <span class="h-2 w-2 shrink-0 rounded-full" :style="{ background: mark.color }" />
              {{ blockAt(mark.id)!.zone.section ? `${blockAt(mark.id)!.zone.section} подъезд · ` : '' }}{{ blockAt(mark.id)!.zone.floor }} этаж
            </p>
            <p class="mt-0.5 text-[11.5px] text-muted">
              Свободно <b class="tabular text-ink">{{ blockAt(mark.id)!.info.free }}</b> из {{ blockAt(mark.id)!.info.total }} · {{ blockAt(mark.id)!.tone.label }}
            </p>

            <dl class="mt-1.5 flex flex-col gap-1 border-t border-line pt-1.5 text-[11.5px]">
              <div v-for="r in blockAt(mark.id)!.info.byRooms" :key="r.rooms" class="flex items-baseline justify-between gap-2">
                <dt class="text-muted">
                  {{ ROOM_LABEL[r.rooms] ?? `${r.rooms}-комнатные` }}
                  <span class="tabular">· {{ r.count }} шт.</span>
                </dt>
                <dd class="tabular shrink-0 font-semibold" :class="r.free ? 'text-ink' : 'text-muted line-through'">
                  от {{ moneyCompact(r.minPrice) }}
                </dd>
              </div>
            </dl>

            <p class="mt-1.5 text-[11px] font-semibold text-plum">Открыть этаж →</p>
          </template>
        </template>
      </UnitZoneCanvas>

      <!-- редактор: поквартирные контуры и служебные слои -->
      <UnitZoneCanvas
        v-else
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
        <!-- продажа: легенда об остатке, а не о статусах отдельных квартир -->
        <div v-if="mode === 'sale'" class="flex flex-wrap items-center gap-2.5">
          <span
            v-for="l in [
              { label: 'Есть выбор', color: 'var(--c-free)' },
              { label: 'Выбор ограничен', color: 'var(--c-reserve)' },
              { label: 'Осталось мало', color: 'var(--c-inst)' },
              { label: 'Всё продано', color: 'var(--c-sold)' },
            ]" :key="l.label"
            class="flex items-center gap-1.5 text-[11.5px] text-muted"
          >
            <span class="h-2.5 w-2.5 rounded-sm" :style="{ background: l.color }" />{{ l.label }}
          </span>
        </div>

        <div v-else class="flex flex-wrap items-center gap-2.5">
          <span v-for="l in statusLegend" :key="l.status" class="flex items-center gap-1.5 text-[11.5px] text-muted">
            <span class="h-2.5 w-2.5 rounded-sm" :style="{ background: l.color }" />
            {{ l.label }} <b class="tabular text-ink">{{ l.count }}</b>
          </span>
        </div>

        <!-- продажа: цены свободных, а не состояние разметки -->
        <p v-if="mode === 'sale' && priceRange" class="ml-auto flex items-center gap-1.5 text-[11.5px] text-muted">
          <Icon name="ph:tag" size="14" />
          Свободные квартиры
          <b class="tabular text-ink">{{ moneyCompact(priceRange.min) }}</b>
          <template v-if="priceRange.max > priceRange.min">— <b class="tabular text-ink">{{ moneyCompact(priceRange.max) }}</b></template>
        </p>

        <!-- редактор: сколько контуров размечено руками и куда идти уточнять -->
        <div v-else-if="mode === 'edit'" class="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-muted">
          <span class="flex items-center gap-1.5">
            <Icon name="ph:polygon" size="14" />
            Размечено вручную <b class="tabular text-ink">{{ stats.total - stats.derived }} из {{ stats.total }}</b>
          </span>
          <span v-if="stats.derived" class="flex items-center gap-1.5">
            <Icon name="ph:dashed-line" size="14" /> пунктир — авторазметка по полосе этажа
          </span>
          <StatusTag :tone="facade.published ? 'ok' : 'neutral'" size="sm">
            {{ facade.published ? 'Опубликован' : 'Черновик' }}
          </StatusTag>
          <NuxtLink
            :to="`/facades/${building.id}/${facade.id}`"
            class="font-semibold text-plum hover:underline"
          >Открыть разметку</NuxtLink>
        </div>
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
