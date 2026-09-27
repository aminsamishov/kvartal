<script setup lang="ts">
import type { Project, PropertyKind } from '~/types/models'

const props = defineProps<{ modelValue: boolean; project: Project | null }>()
const emit = defineEmits<{ 'update:modelValue': [boolean]; saved: [Project] }>()

const unitsStore = useUnitsStore()
const settingsStore = useSettingsStore()
const ui = useUiStore()

const propertyKinds: { value: PropertyKind; label: string }[] = [
  { value: 'residential', label: 'Жилой комплекс' }, { value: 'commercial', label: 'Коммерческая недвижимость' }, { value: 'mixed', label: 'Смешанный' },
]

function blank() {
  return {
    name: '', propertyKind: 'residential' as PropertyKind, address: '', developer: '', banks: [] as string[],
    currency: 'USD' as Project['currency'], country: 'Кыргызстан', stage: 'Планирование', salesStart: '',
    infrastructure: '', website: '', salesOfficeId: '', accent: '#6E4453',
  }
}
const form = reactive(blank())
const bankInput = ref('')

watch(() => [props.modelValue, props.project] as const, ([open, project]) => {
  if (!open) return
  Object.assign(form, project ? {
    name: project.name, propertyKind: project.propertyKind, address: project.address, developer: project.developer,
    banks: [...project.banks], currency: project.currency, country: project.country, stage: project.stage,
    salesStart: project.salesStart?.slice(0, 10) ?? '', infrastructure: project.infrastructure, website: project.website,
    salesOfficeId: project.salesOfficeId, accent: project.accent,
  } : blank())
}, { immediate: true })

function addBank() {
  const v = bankInput.value.trim()
  if (v && !form.banks.includes(v)) form.banks.push(v)
  bankInput.value = ''
}
function removeBank(b: string) {
  form.banks = form.banks.filter((x) => x !== b)
}

function close() {
  emit('update:modelValue', false)
}

function submit() {
  if (!form.name.trim()) {
    ui.toast('Укажите название проекта', 'warn')
    return
  }
  const payload = { ...form, salesStart: form.salesStart ? new Date(form.salesStart).toISOString() : new Date().toISOString() }
  if (props.project) {
    unitsStore.updateProject(props.project.id, payload)
    ui.toast('Проект обновлён', 'ok')
    emit('saved', props.project)
  } else {
    const created = unitsStore.createProject(payload)
    ui.toast('Проект создан', 'ok')
    emit('saved', created)
  }
  close()
}
</script>

<template>
  <AppDrawer :model-value="modelValue" :title="project ? 'Редактировать проект' : 'Новый проект'" width="520px" @update:model-value="close">
    <div class="flex flex-col gap-4">
      <AppSelect v-model="form.propertyKind" label="Тип объекта" :options="propertyKinds" />
      <AppInput v-model="form.name" label="Название" placeholder="ЖК «Название»" />
      <AppInput v-model="form.address" label="Адрес" placeholder="Город, улица" />
      <AppInput v-model="form.developer" label="Застройщик" />

      <label class="flex flex-col gap-1.5 text-[12.5px] font-medium text-muted">
        <span>Банки (аккредитация)</span>
        <div class="flex flex-wrap gap-1.5 rounded-xl2 border border-line p-2">
          <span v-for="b in form.banks" :key="b" class="flex items-center gap-1 rounded-full bg-soft px-2.5 py-1 text-[12px] font-medium text-ink">
            {{ b }} <button type="button" class="text-muted hover:text-bad" @click="removeBank(b)"><Icon name="ph:x" size="11" /></button>
          </span>
          <input v-model="bankInput" placeholder="Добавить и Enter" class="min-w-[120px] flex-1 border-0 bg-transparent px-1 py-1 text-[13px] text-ink outline-none" @keydown.enter.prevent="addBank">
        </div>
      </label>

      <div class="grid grid-cols-2 gap-3">
        <AppSelect v-model="form.currency" label="Валюта" :options="[{ value: 'USD', label: 'USD' }, { value: 'KGS', label: 'KGS (сом)' }]" />
        <AppInput v-model="form.country" label="Страна" />
      </div>
      <div class="grid grid-cols-2 gap-3">
        <AppInput v-model="form.stage" label="Стадия строительства" placeholder="Котлован, Строительство…" />
        <AppInput v-model="form.salesStart" type="date" label="Старт продаж" />
      </div>

      <label class="flex flex-col gap-1.5 text-[12.5px] font-medium text-muted">
        <span>Инфраструктура</span>
        <textarea v-model="form.infrastructure" rows="3" class="focus-ring rounded-xl2 border border-line bg-panel px-3 py-2 text-[14px] font-normal text-ink" placeholder="Детский сад, паркинг, двор без машин…" />
      </label>

      <AppInput v-model="form.website" label="Сайт" placeholder="https://" />
      <AppSelect v-model="form.salesOfficeId" label="Отдел продаж" :options="settingsStore.salesOffices.map((o) => ({ value: o.id, label: o.name }))" placeholder="Не выбран" />

      <label class="flex flex-col gap-1.5 text-[12.5px] font-medium text-muted">
        <span>Акцентный цвет</span>
        <div class="flex items-center gap-2">
          <input v-model="form.accent" type="color" class="h-10 w-14 cursor-pointer rounded-xl2 border border-line bg-panel p-1">
          <span class="tabular text-[13px] text-muted">{{ form.accent }}</span>
        </div>
      </label>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <AppButton @click="close">Отмена</AppButton>
        <AppButton variant="primary" icon="ph:check-bold" @click="submit">{{ project ? 'Сохранить' : 'Создать проект' }}</AppButton>
      </div>
    </template>
  </AppDrawer>
</template>
