<script setup lang="ts">
import type { Building, UnitTypePreset } from '~/types/models'

const props = defineProps<{ modelValue: boolean; building: Building; preset: UnitTypePreset | null }>()
const emit = defineEmits<{ 'update:modelValue': [boolean] }>()

const unitsStore = useUnitsStore()
const ui = useUiStore()

const search = ref('')
const selected = ref<Set<string>>(new Set())

const buildingUnits = computed(() => unitsStore.units.filter((u) => u.buildingId === props.building.id && u.kind === 'apartment').sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true })))
const filtered = computed(() => buildingUnits.value.filter((u) => !search.value || u.number.includes(search.value)))

watch(() => [props.modelValue, props.preset] as const, ([open, preset]) => {
  if (!open || !preset) return
  selected.value = new Set(unitsStore.unitsForPreset(preset.id).map((u) => u.id))
}, { immediate: true })

function toggle(id: string) {
  const next = new Set(selected.value)
  next.has(id) ? next.delete(id) : next.add(id)
  selected.value = next
}

function selectByRooms() {
  if (!props.preset) return
  const next = new Set(selected.value)
  buildingUnits.value.filter((u) => u.rooms === props.preset!.rooms).forEach((u) => next.add(u.id))
  selected.value = next
}

function close() {
  emit('update:modelValue', false)
}

function save() {
  if (!props.preset) return
  unitsStore.setPresetUnits(props.building.id, props.preset.id, [...selected.value])
  ui.toast('Помещения привязаны к планировке', 'ok')
  close()
}
</script>

<template>
  <AppModal :model-value="modelValue" :title="preset ? `Отметить на шахматке — «${preset.name}»` : ''" width="lg" @update:model-value="close">
    <div v-if="preset" class="flex flex-col gap-3.5">
      <p class="text-[12.5px] text-muted">
        Выберите помещения, которые соответствуют этой планировке. Позже здесь появится выбор точечным кликом прямо на шахматке.
      </p>
      <div class="flex items-center gap-2">
        <AppInput v-model="search" placeholder="Поиск по номеру" icon="ph:magnifying-glass" class="flex-1" />
        <AppButton size="sm" @click="selectByRooms">Все {{ preset.rooms }}-комнатные</AppButton>
      </div>
      <div class="max-h-[360px] overflow-y-auto rounded-xl2 border border-line">
        <label
          v-for="u in filtered" :key="u.id"
          class="flex cursor-pointer items-center gap-2.5 border-b border-line px-3 py-2 text-[13px] last:border-0 hover:bg-soft"
        >
          <input type="checkbox" class="accent-plum" :checked="selected.has(u.id)" @change="toggle(u.id)">
          <span class="font-semibold">№ {{ u.number }}</span>
          <span class="text-muted">{{ u.rooms }}-комн. · {{ u.area }} м² · секция {{ u.section }}, этаж {{ u.floor }}</span>
        </label>
        <EmptyState v-if="!filtered.length" compact icon="ph:magnifying-glass" title="Не найдено" />
      </div>
      <div class="flex items-center justify-between">
        <span class="text-[12.5px] text-muted">Выбрано: {{ selected.size }}</span>
        <div class="flex gap-2">
          <AppButton @click="close">Отмена</AppButton>
          <AppButton variant="primary" icon="ph:check-bold" @click="save">Сохранить</AppButton>
        </div>
      </div>
    </div>
  </AppModal>
</template>
