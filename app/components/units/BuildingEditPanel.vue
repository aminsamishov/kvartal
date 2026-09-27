<script setup lang="ts">
import type { Building, UnitKind } from '~/types/models'
import { UNIT_KIND_META } from '~/utils/meta'

const props = defineProps<{ modelValue: boolean; projectId: string; building: Building | null }>()
const emit = defineEmits<{ 'update:modelValue': [boolean]; saved: [Building] }>()

const unitsStore = useUnitsStore()
const settingsStore = useSettingsStore()
const ui = useUiStore()

const kindOptions = (Object.entries(UNIT_KIND_META) as [UnitKind, typeof UNIT_KIND_META[UnitKind]][]).map(([value, m]) => ({ value, label: m.label }))

function blank() {
  return {
    name: '', defaultUnitKind: 'apartment' as UnitKind, structureType: 'residential' as Building['structureType'],
    address: '', contractAddress: '', finishing: '', material: '', cadastralNumber: '',
    constructionStart: '', constructionEnd: '', deliveryDate: '', salesStart: '', salesEnd: '',
    elevatorsPassenger: 1, elevatorsFreight: 1, hasTrashChute: false, hasShowroom: false,
    slogan: '', salesOfficeId: '', sections: 1, floors: 9, floorsBelow: 0, badge: '',
  }
}
const form = reactive(blank())

function toDateInput(v: string) { return v ? v.slice(0, 10) : '' }

watch(() => [props.modelValue, props.building] as const, ([open, b]) => {
  if (!open) return
  Object.assign(form, b ? {
    name: b.name, defaultUnitKind: b.defaultUnitKind, structureType: b.structureType, address: b.address,
    contractAddress: b.contractAddress, finishing: b.finishing, material: b.material, cadastralNumber: b.cadastralNumber,
    constructionStart: toDateInput(b.constructionStart), constructionEnd: toDateInput(b.constructionEnd),
    deliveryDate: toDateInput(b.deliveryDate), salesStart: toDateInput(b.salesStart), salesEnd: toDateInput(b.salesEnd),
    elevatorsPassenger: b.elevatorsPassenger, elevatorsFreight: b.elevatorsFreight, hasTrashChute: b.hasTrashChute,
    hasShowroom: b.hasShowroom, slogan: b.slogan, salesOfficeId: b.salesOfficeId, sections: b.sections,
    floors: b.floors, floorsBelow: b.floorsBelow, badge: b.badge ?? '',
  } : blank())
}, { immediate: true })

function close() {
  emit('update:modelValue', false)
}

function submit() {
  if (!form.name.trim()) {
    ui.toast('Укажите название дома', 'warn')
    return
  }
  const iso = (v: string) => (v ? new Date(v).toISOString() : '')
  const payload = {
    ...form, badge: form.badge.trim() || null,
    constructionStart: iso(form.constructionStart), constructionEnd: iso(form.constructionEnd),
    deliveryDate: iso(form.deliveryDate), salesStart: iso(form.salesStart), salesEnd: iso(form.salesEnd),
  }
  if (props.building) {
    unitsStore.updateBuilding(props.building.id, payload)
    ui.toast('Дом обновлён', 'ok')
    emit('saved', props.building)
  } else {
    const created = unitsStore.createBuilding(props.projectId, payload)
    ui.toast('Дом добавлен', 'ok')
    emit('saved', created)
  }
  close()
}
</script>

<template>
  <AppDrawer :model-value="modelValue" :title="building ? `Редактировать «${building.name}»` : 'Новый дом'" width="560px" @update:model-value="close">
    <div class="flex flex-col gap-5">
      <div class="flex flex-col gap-3.5">
        <p class="text-[11.5px] font-bold uppercase tracking-wide text-muted">Основное</p>
        <AppInput v-model="form.name" label="Название" placeholder="Дом 1" />
        <div class="grid grid-cols-2 gap-3">
          <AppSelect v-model="form.defaultUnitKind" label="Тип помещений по умолчанию" :options="kindOptions" />
          <AppSelect v-model="form.structureType" label="Тип строения" :options="[{ value: 'residential', label: 'Жилое' }, { value: 'non_residential', label: 'Нежилое' }]" />
        </div>
        <AppInput v-model="form.address" label="Адрес" />
        <AppInput v-model="form.contractAddress" label="Адрес по договору" hint="Если отличается от почтового" />
        <div class="grid grid-cols-2 gap-3">
          <AppInput v-model="form.finishing" label="Отделка помещений" placeholder="Черновая, чистовая…" />
          <AppInput v-model="form.material" label="Материал дома" placeholder="Монолит-кирпич…" />
        </div>
        <AppInput v-model="form.cadastralNumber" label="Кадастровый номер земли" />
      </div>

      <div class="flex flex-col gap-3.5 border-t border-line pt-4">
        <p class="text-[11.5px] font-bold uppercase tracking-wide text-muted">Строительство и продажи</p>
        <div class="grid grid-cols-2 gap-3">
          <AppInput v-model="form.constructionStart" type="date" label="Начало строительства" />
          <AppInput v-model="form.constructionEnd" type="date" label="Завершение строительства" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <AppInput v-model="form.salesStart" type="date" label="Старт продаж" />
          <AppInput v-model="form.salesEnd" type="date" label="Окончание продаж" />
        </div>
        <AppInput v-model="form.deliveryDate" type="date" label="Срок сдачи в эксплуатацию" />
        <AppSelect v-model="form.salesOfficeId" label="Офис продаж" :options="settingsStore.salesOffices.map((o) => ({ value: o.id, label: o.name }))" placeholder="Не выбран" />
      </div>

      <div class="flex flex-col gap-3.5 border-t border-line pt-4">
        <p class="text-[11.5px] font-bold uppercase tracking-wide text-muted">Конструктив</p>
        <div class="grid grid-cols-3 gap-3">
          <AppInput v-model.number="form.sections" type="number" label="Подъездов" />
          <AppInput v-model.number="form.floors" type="number" label="Этажей надземных" />
          <AppInput v-model.number="form.floorsBelow" type="number" label="Этажей подземных" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <AppInput v-model.number="form.elevatorsPassenger" type="number" label="Лифтов пассажирских" />
          <AppInput v-model.number="form.elevatorsFreight" type="number" label="Лифтов грузовых" />
        </div>
        <label class="flex items-center gap-2.5 text-[13px]"><input v-model="form.hasTrashChute" type="checkbox" class="accent-plum"> Наличие мусоропровода</label>
        <label class="flex items-center gap-2.5 text-[13px]"><input v-model="form.hasShowroom" type="checkbox" class="accent-plum"> Наличие шоурума в доме</label>
      </div>

      <div class="flex flex-col gap-3.5 border-t border-line pt-4">
        <p class="text-[11.5px] font-bold uppercase tracking-wide text-muted">Маркетинг</p>
        <AppInput v-model="form.slogan" label="Рекламный слоган" />
        <AppInput v-model="form.badge" label="Бейдж на доме" placeholder="Например, «Старт продаж»" />
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <AppButton @click="close">Отмена</AppButton>
        <AppButton variant="primary" icon="ph:check-bold" @click="submit">{{ building ? 'Сохранить' : 'Добавить дом' }}</AppButton>
      </div>
    </template>
  </AppDrawer>
</template>
