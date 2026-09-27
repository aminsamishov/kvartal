<script setup lang="ts">
import { emptyUnitFilters, FINISHING_KINDS, FINISHING_META, hasAnyFilter, type UnitFilterState } from '~/utils/unitFilters'

const props = defineProps<{ sections?: number[]; floors?: { min: number; max: number } }>()
const filters = defineModel<UnitFilterState>({ required: true })

function reset() {
  // поиск набран руками и живёт в строке над панелью — сбрасывать его отсюда
  // значит стирать то, чего пользователь в этой панели не видит
  const search = filters.value.search
  filters.value = { ...emptyUnitFilters(), search }
}

function toggleSection(section: number) {
  const list = filters.value.sections
  filters.value = { ...filters.value, sections: list.includes(section) ? list.filter((s) => s !== section) : [...list, section] }
}
function toggleFinishing(kind: typeof FINISHING_KINDS[number]) {
  const list = filters.value.finishing
  filters.value = { ...filters.value, finishing: list.includes(kind) ? list.filter((f) => f !== kind) : [...list, kind] }
}

const hasFilters = computed(() => hasAnyFilter(filters.value))
void props
</script>

<template>
  <div class="flex max-h-[min(70vh,520px)] flex-col gap-4 overflow-y-auto">
    <label class="flex cursor-pointer items-center justify-between gap-3 rounded-xl2 border border-line px-3 py-2">
      <span class="text-[12.5px] font-semibold">Только свободные и в брони</span>
      <input v-model="filters.onlyAvailable" type="checkbox" class="accent-plum">
    </label>

    <div>
      <p class="mb-2 text-[12.5px] font-semibold">Комнатность</p>
      <div class="flex items-center gap-2">
        <AppInput v-model="filters.roomsMin" type="number" placeholder="от" />
        <span class="text-muted">—</span>
        <AppInput v-model="filters.roomsMax" type="number" placeholder="до" />
      </div>
    </div>

    <div>
      <p class="mb-2 text-[12.5px] font-semibold">Стоимость, $</p>
      <div class="flex items-center gap-2">
        <AppInput v-model="filters.priceMin" type="number" placeholder="от" />
        <span class="text-muted">—</span>
        <AppInput v-model="filters.priceMax" type="number" placeholder="до" />
      </div>
    </div>

    <div>
      <p class="mb-2 text-[12.5px] font-semibold">Площадь, м²</p>
      <div class="flex items-center gap-2">
        <AppInput v-model="filters.areaMin" type="number" placeholder="от" />
        <span class="text-muted">—</span>
        <AppInput v-model="filters.areaMax" type="number" placeholder="до" />
      </div>
    </div>

    <div>
      <p class="mb-2 text-[12.5px] font-semibold">
        Этаж
        <span v-if="floors" class="font-normal text-muted">· в доме {{ floors.min }}–{{ floors.max }}</span>
      </p>
      <div class="flex items-center gap-2">
        <AppInput v-model="filters.floorMin" type="number" placeholder="от" />
        <span class="text-muted">—</span>
        <AppInput v-model="filters.floorMax" type="number" placeholder="до" />
      </div>
    </div>

    <div v-if="sections && sections.length > 1">
      <p class="mb-2 text-[12.5px] font-semibold">Секция</p>
      <div class="flex flex-wrap gap-1.5">
        <Chip v-for="s in sections" :key="s" :pressed="filters.sections.includes(s)" @click="toggleSection(s)">{{ s }}</Chip>
      </div>
    </div>

    <div>
      <p class="mb-2 text-[12.5px] font-semibold">Отделка</p>
      <div class="flex flex-wrap gap-1.5">
        <Chip v-for="f in FINISHING_KINDS" :key="f" :pressed="filters.finishing.includes(f)" @click="toggleFinishing(f)">
          {{ FINISHING_META[f] }}
        </Chip>
      </div>
    </div>

    <button
      v-if="hasFilters" type="button"
      class="flex items-center justify-center gap-1.5 rounded-xl2 border border-line py-2 text-[12.5px] font-semibold text-muted hover:bg-soft hover:text-ink"
      @click="reset"
    >
      <Icon name="ph:arrow-counter-clockwise" size="13" /> Сбросить все фильтры
    </button>
  </div>
</template>
