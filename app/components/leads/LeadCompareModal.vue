<script setup lang="ts">
import { UNIT_STATUS_META } from '~/utils/meta'
import { area as fmtArea, money } from '~/utils/format'
import { explicationTotals } from '~/utils/explication'

const props = defineProps<{ modelValue: boolean; unitIds: string[]; leadId: string }>()
const emit = defineEmits<{ 'update:modelValue': [boolean]; reserve: [string] }>()

const unitsStore = useUnitsStore()

const units = computed(() => props.unitIds.map((id) => unitsStore.unit(id)).filter((u): u is NonNullable<typeof u> => !!u))

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
}))
</script>

<template>
  <AppModal :model-value="modelValue" title="Сравнение квартир" width="xl" @update:model-value="emit('update:modelValue', $event)">
    <div class="overflow-x-auto">
      <table class="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            <th class="w-[140px] px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.03em] text-muted">Параметр</th>
            <th v-for="u in units" :key="u.id" class="px-2 py-2 text-left">
              <div class="aspect-square w-full max-w-[150px] overflow-hidden rounded-xl2 border border-line bg-soft">
                <img v-if="thumbOf(u.id)" :src="thumbOf(u.id)!" class="h-full w-full object-contain" :alt="`№ ${u.number}`">
                <span v-else class="grid h-full w-full place-items-center text-muted"><Icon name="ph:floor-plan" size="22" /></span>
              </div>
              <p class="tabular mt-1.5 text-[14px] font-semibold text-ink">№ {{ u.number }}</p>
              <StatusTag :tone="UNIT_STATUS_META[u.status].tone" size="sm" dot>{{ UNIT_STATUS_META[u.status].label }}</StatusTag>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in [
            { key: 'building', label: 'Дом' }, { key: 'floor', label: 'Этаж' }, { key: 'rooms', label: 'Комнат' },
            { key: 'area', label: 'Площадь' }, { key: 'living', label: 'Жилая' },
            { key: 'price', label: 'Цена' }, { key: 'perM2', label: 'Цена за м²' },
          ]" :key="row.key" class="border-t border-line"
          >
            <td class="px-2 py-2 text-[12px] text-muted">{{ row.label }}</td>
            <td
              v-for="u in units" :key="u.id" class="tabular px-2 py-2 font-medium"
              :class="{
                'text-ok font-bold': (row.key === 'price' && u.price === best.price)
                  || (row.key === 'perM2' && Math.round(u.price / (u.area || 1)) === best.perM2)
                  || (row.key === 'area' && u.area === best.area)
                  || (row.key === 'floor' && u.floor === best.floor),
              }"
            >
              <template v-if="row.key === 'building'">{{ unitsStore.building(u.buildingId)?.name ?? '—' }}</template>
              <template v-else-if="row.key === 'floor'">{{ u.floor }}</template>
              <template v-else-if="row.key === 'rooms'">{{ u.rooms || '—' }}</template>
              <template v-else-if="row.key === 'area'">{{ fmtArea(u.area) }}</template>
              <template v-else-if="row.key === 'living'">{{ livingOf(u.id) ? fmtArea(livingOf(u.id)!) : '—' }}</template>
              <template v-else-if="row.key === 'price'">{{ money(u.price) }}</template>
              <template v-else>{{ money(Math.round(u.price / (u.area || 1))) }}</template>
            </td>
          </tr>
          <tr class="border-t border-line">
            <td />
            <td v-for="u in units" :key="u.id" class="px-2 pt-3">
              <AppButton
                size="sm" variant="primary" icon="ph:bookmark-simple" block :disabled="u.status !== 'free'"
                @click="emit('reserve', u.id); emit('update:modelValue', false)"
              >Забронировать</AppButton>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </AppModal>
</template>
