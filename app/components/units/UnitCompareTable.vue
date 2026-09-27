<script setup lang="ts">
import type { MatchedUnit } from '~/composables/useLeadMatching'
import { UNIT_STATUS_META } from '~/utils/meta'
import { area as fmtArea, money } from '~/utils/format'
import { explicationTotals } from '~/utils/explication'
import { FINISHING_META } from '~/utils/unitFilters'

/**
 * Таблица сравнения. Одна и та же и в панели снизу, и в модальном окне:
 * менеджер не должен переучиваться, переходя от быстрого взгляда к разбору.
 *
 * `dense` — вариант для панели: планировки мельче, строки плотнее, таблица
 * прокручивается внутри себя и не выдавливает шахматку за экран.
 */
const props = defineProps<{
  unitIds: string[]
  /** режим подбора: показываем процент совпадения и кнопку брони */
  leadId?: string
  scores?: Map<string, MatchedUnit>
  dense?: boolean
}>()
const emit = defineEmits<{ reserve: [string]; open: [string] }>()

const unitsStore = useUnitsStore()

const units = computed(() => props.unitIds
  .map((id) => unitsStore.unit(id))
  .filter((u): u is NonNullable<typeof u> => !!u))

function presetOf(unitId: string) {
  const u = unitsStore.unit(unitId)
  if (!u?.layoutPresetId) return undefined
  return unitsStore.building(u.buildingId)?.unitTypePresets.find((p) => p.id === u.layoutPresetId)
}
function thumbOf(unitId: string) {
  const u = unitsStore.unit(unitId)
  return u?.imageUrl || presetOf(unitId)?.imageUrl || null
}
function livingOf(unitId: string) {
  const u = unitsStore.unit(unitId)
  const rooms = u?.explication?.length ? u.explication : presetOf(unitId)?.explication ?? []
  return rooms.length ? explicationTotals(rooms).living : null
}

// лучшее значение в строке подсвечиваем — ради этого сравнение и открывают
const best = computed(() => ({
  price: Math.min(...units.value.map((u) => u.price)),
  perM2: Math.min(...units.value.map((u) => Math.round(u.price / (u.area || 1)))),
  area: Math.max(...units.value.map((u) => u.area)),
  floor: Math.max(...units.value.map((u) => u.floor)),
  score: Math.max(...units.value.map((u) => props.scores?.get(u.id)?.score ?? 0)),
}))

const rows = computed(() => {
  const base = [
    { key: 'building', label: 'Дом' }, { key: 'floor', label: 'Этаж' }, { key: 'rooms', label: 'Комнат' },
    { key: 'area', label: 'Площадь' }, { key: 'living', label: 'Жилая' }, { key: 'finishing', label: 'Отделка' },
    { key: 'price', label: 'Цена' }, { key: 'perM2', label: 'Цена за м²' },
  ]
  return props.scores?.size ? [{ key: 'score', label: 'Совпадение' }, ...base] : base
})
</script>

<template>
  <div class="overflow-x-auto">
    <table class="w-full border-collapse" :class="dense ? 'text-[12px]' : 'text-[13px]'">
      <thead>
        <tr>
          <th
            class="sticky left-0 z-10 bg-panel px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.03em] text-muted"
            :class="dense ? 'w-[104px]' : 'w-[130px]'"
          >Параметр</th>
          <th v-for="u in units" :key="u.id" class="px-2 py-2 text-left align-top">
            <button
              type="button"
              class="focus-ring block w-full overflow-hidden rounded-xl2 border border-line bg-soft"
              :class="dense ? 'h-[62px]' : 'aspect-square max-w-[150px]'"
              title="Открыть карточку" @click="emit('open', u.id)"
            >
              <img v-if="thumbOf(u.id)" :src="thumbOf(u.id)!" class="h-full w-full object-contain" :alt="`№ ${u.number}`">
              <span v-else class="grid h-full w-full place-items-center text-muted"><Icon name="ph:floor-plan" :size="dense ? 16 : 22" /></span>
            </button>
            <p class="tabular mt-1.5 font-semibold text-ink" :class="dense ? 'text-[12.5px]' : 'text-[14px]'">№ {{ u.number }}</p>
            <StatusTag :tone="UNIT_STATUS_META[u.status].tone" size="sm" dot>{{ UNIT_STATUS_META[u.status].label }}</StatusTag>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.key" class="border-t border-line">
          <td class="sticky left-0 z-10 bg-panel px-2 text-[12px] text-muted" :class="dense ? 'py-1' : 'py-2'">{{ row.label }}</td>
          <td
            v-for="u in units" :key="u.id" class="tabular px-2 font-medium"
            :class="[dense ? 'py-1' : 'py-2', {
              'font-bold text-ok': (row.key === 'price' && u.price === best.price)
                || (row.key === 'perM2' && Math.round(u.price / (u.area || 1)) === best.perM2)
                || (row.key === 'area' && u.area === best.area)
                || (row.key === 'floor' && u.floor === best.floor)
                || (row.key === 'score' && (scores?.get(u.id)?.score ?? 0) === best.score && best.score > 0),
            }]"
          >
            <template v-if="row.key === 'building'">{{ unitsStore.building(u.buildingId)?.name ?? '—' }}</template>
            <template v-else-if="row.key === 'floor'">{{ u.floor }}</template>
            <template v-else-if="row.key === 'rooms'">{{ u.rooms || '—' }}</template>
            <template v-else-if="row.key === 'area'">{{ fmtArea(u.area) }}</template>
            <template v-else-if="row.key === 'living'">{{ livingOf(u.id) ? fmtArea(livingOf(u.id)!) : '—' }}</template>
            <template v-else-if="row.key === 'finishing'">{{ FINISHING_META[u.finishing] }}</template>
            <template v-else-if="row.key === 'price'">{{ money(u.price) }}</template>
            <template v-else-if="row.key === 'score'">{{ scores?.get(u.id) ? `${scores.get(u.id)!.score}%` : '—' }}</template>
            <template v-else>{{ money(Math.round(u.price / (u.area || 1))) }}</template>
          </td>
        </tr>

        <!-- чем именно не подошла: причины видны сразу под цифрами -->
        <tr v-if="scores?.size" class="border-t border-line align-top">
          <td class="sticky left-0 z-10 bg-panel px-2 text-[12px] text-muted" :class="dense ? 'py-1' : 'py-2'">Не совпало</td>
          <td v-for="u in units" :key="u.id" class="px-2" :class="dense ? 'py-1' : 'py-2'">
            <div v-if="scores.get(u.id)?.misses.length" class="flex flex-wrap gap-1">
              <span v-for="m in scores.get(u.id)!.misses" :key="m" class="rounded bg-warn-bg px-1.5 py-0.5 text-[10.5px] font-medium text-warn">{{ m }}</span>
            </div>
            <span v-else class="text-[11.5px] text-ok">всё по запросу</span>
          </td>
        </tr>

        <tr v-if="leadId" class="border-t border-line">
          <td class="sticky left-0 z-10 bg-panel" />
          <td v-for="u in units" :key="u.id" class="px-2 pt-2.5">
            <AppButton
              size="sm" variant="primary" icon="ph:bookmark-simple" block :disabled="u.status !== 'free'"
              @click="emit('reserve', u.id)"
            >Забронировать</AppButton>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
