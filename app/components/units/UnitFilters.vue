<script setup lang="ts">
import { emptyUnitFilters, type UnitFilterState } from '~/utils/unitFilters'

const filters = defineModel<UnitFilterState>({ required: true })

function reset() {
  filters.value = emptyUnitFilters()
}

const hasFilters = computed(() => filters.value.kinds.length || filters.value.statuses.length || filters.value.roomsMin || filters.value.roomsMax || filters.value.priceMin || filters.value.priceMax || filters.value.areaMin || filters.value.areaMax)
</script>

<template>
  <div class="flex flex-col gap-4">
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

    <button
      v-if="hasFilters" type="button"
      class="flex items-center justify-center gap-1.5 rounded-xl2 border border-line py-2 text-[12.5px] font-semibold text-muted hover:bg-soft hover:text-ink"
      @click="reset"
    >
      <Icon name="ph:arrow-counter-clockwise" size="13" /> Сбросить все фильтры
    </button>
  </div>
</template>
