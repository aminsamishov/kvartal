<script setup lang="ts">
import type { Building, UnitStatus } from '~/types/models'
import { UNIT_STATUS_META } from '~/utils/meta'

const props = defineProps<{ building: Building }>()
const unitsStore = useUnitsStore()

const activeSection = ref(1)
const expandAll = ref(false)
const expanded = reactive<Set<number>>(new Set())

const floorsDesc = computed(() => Array.from({ length: props.building.floors }, (_, i) => props.building.floors - i))

function unitsFor(floor: number) {
  return unitsStore.units
    .filter((u) => u.buildingId === props.building.id && u.section === activeSection.value && u.floor === floor)
    .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }))
}

function isOpen(floor: number) {
  return expandAll.value || expanded.has(floor)
}
function toggleFloor(floor: number) {
  if (expanded.has(floor)) expanded.delete(floor)
  else expanded.add(floor)
}

function addUnit(floor: number) {
  const created = unitsStore.addManualUnit(props.building.id, activeSection.value, floor)
  expanded.add(floor)
  return created
}

function patch(unitId: string, field: string, raw: string) {
  if (field === 'number' || field === 'status' || field === 'finishing') {
    unitsStore.patchUnit(unitId, { [field]: raw })
    return
  }
  const n = Number(raw)
  if (Number.isFinite(n)) unitsStore.patchUnit(unitId, { [field]: n, ...(field === 'price' ? { basePrice: n } : {}) })
}

const statusOptions = Object.entries(UNIT_STATUS_META) as [UnitStatus, typeof UNIT_STATUS_META[UnitStatus]][]
</script>

<template>
  <div class="flex flex-col gap-4">
    <p class="text-[13px] text-muted">На этой странице можно заполнить дом помещениями вручную, без импорта, и быстро поправить отдельные помещения.</p>

    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="s in building.sections" :key="s" type="button"
          class="focus-ring rounded-xl2 border px-3.5 py-1.5 text-[13px] font-semibold transition-colors"
          :class="activeSection === s ? 'border-plum bg-plum-soft text-plum' : 'border-line text-muted hover:bg-soft'"
          @click="activeSection = s"
        >
          Секция {{ s }}
        </button>
      </div>
      <button type="button" class="flex items-center gap-1.5 text-[12.5px] font-semibold text-plum hover:underline" @click="expandAll = !expandAll">
        <Icon :name="expandAll ? 'ph:arrows-in-line-vertical' : 'ph:arrows-out-line-vertical'" size="14" />
        {{ expandAll ? 'Свернуть все этажи' : 'Развернуть все этажи' }}
      </button>
    </div>

    <div class="flex flex-col rounded-card border border-line bg-panel shadow-card">
      <div v-for="floor in floorsDesc" :key="floor" class="border-b border-line last:border-0">
        <button type="button" class="focus-ring flex w-full items-center justify-between px-4 py-3 text-left hover:bg-soft" @click="toggleFloor(floor)">
          <span class="flex items-center gap-2.5">
            <Icon name="ph:caret-right" size="14" class="text-muted transition-transform" :class="isOpen(floor) ? 'rotate-90' : ''" />
            <span class="text-[13.5px] font-semibold">Этаж {{ floor }}</span>
          </span>
          <span class="tabular text-[12px] text-muted">{{ unitsFor(floor).length ? `${unitsFor(floor).length} помещений` : 'пусто' }}</span>
        </button>

        <div v-if="isOpen(floor)" class="border-t border-line bg-soft/40 px-4 py-3.5">
          <EmptyState
            v-if="!unitsFor(floor).length" compact icon="ph:selection" title="Этаж пуст"
            text="Добавьте первое помещение на этот этаж"
          >
            <template #action><AppButton size="sm" variant="primary" icon="ph:plus-bold" @click="addUnit(floor)">Добавить помещение</AppButton></template>
          </EmptyState>

          <template v-else>
            <div class="overflow-x-auto rounded-xl2 border border-line bg-panel">
              <table class="data-table">
                <thead>
                  <tr><th>Номер</th><th>Комнат</th><th>Площадь, м²</th><th>Цена, $</th><th>Статус</th><th /></tr>
                </thead>
                <tbody>
                  <tr v-for="u in unitsFor(floor)" :key="u.id">
                    <td><input :value="u.number" class="focus-ring w-24 rounded-lg border border-line bg-panel px-2 py-1 text-[13px] font-semibold" placeholder="№" @change="patch(u.id, 'number', ($event.target as HTMLInputElement).value)"></td>
                    <td><input type="number" :value="u.rooms" class="focus-ring w-16 rounded-lg border border-line bg-panel px-2 py-1 text-[13px]" @change="patch(u.id, 'rooms', ($event.target as HTMLInputElement).value)"></td>
                    <td><input type="number" :value="u.area" class="focus-ring w-20 rounded-lg border border-line bg-panel px-2 py-1 text-[13px]" @change="patch(u.id, 'area', ($event.target as HTMLInputElement).value)"></td>
                    <td><input type="number" :value="u.price" class="focus-ring w-24 rounded-lg border border-line bg-panel px-2 py-1 text-[13px]" @change="patch(u.id, 'price', ($event.target as HTMLInputElement).value)"></td>
                    <td>
                      <select :value="u.status" class="focus-ring rounded-lg border border-line bg-panel px-2 py-1 text-[12.5px]" @change="patch(u.id, 'status', ($event.target as HTMLSelectElement).value)">
                        <option v-for="[key, meta] in statusOptions" :key="key" :value="key">{{ meta.label }}</option>
                      </select>
                    </td>
                    <td><button class="text-muted hover:text-bad" title="Удалить" @click="unitsStore.removeUnit(u.id)"><Icon name="ph:trash" size="15" /></button></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <button type="button" class="mt-2.5 flex items-center gap-1.5 text-[12.5px] font-semibold text-plum hover:underline" @click="addUnit(floor)">
              <Icon name="ph:plus" size="13" /> Добавить помещение на этот этаж
            </button>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
