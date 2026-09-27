<script setup lang="ts">
import type { Project, PropertyKind } from '~/types/models'

const props = defineProps<{ modelValue: boolean; project: Project | null }>()
const emit = defineEmits<{ 'update:modelValue': [boolean]; saved: [Project] }>()

const unitsStore = useUnitsStore()
const settingsStore = useSettingsStore()
const ui = useUiStore()

const propertyKinds: { value: PropertyKind; label: string; icon: string }[] = [
  { value: 'residential', label: 'Жилой комплекс', icon: 'ph:buildings' },
  { value: 'commercial', label: 'Коммерческая', icon: 'ph:storefront' },
  { value: 'mixed', label: 'Смешанный', icon: 'ph:squares-four' },
]

/** Палитра проектов: цвет ЖК встречается в шахматке, списках и на генплане,
 * поэтому выбирается из согласованного набора, а не пипеткой наугад. */
const ACCENTS = ['#6E4453', '#3A6EA5', '#2F7D5C', '#B8780E', '#7B5EA7', '#34495A', '#B93A2F', '#3E8FA8']

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
  <AppDrawer
    :model-value="modelValue" :title="project ? 'Редактировать проект' : 'Новый проект'"
    :subtitle="project ? 'Поля уходят на витрину, в презентацию и в договор' : 'Второй ЖК — это новая запись, а не новая система'"
    width="min(560px, 96vw)" @update:model-value="close"
  >
    <div class="flex flex-col gap-5">
      <!-- как проект будет выглядеть в списках -->
      <div class="flex items-center gap-3 rounded-card border border-line bg-soft/60 p-3">
        <span
          class="grid h-12 w-12 shrink-0 place-items-center rounded-xl2 text-[15px] font-bold text-white"
          :style="{ background: form.accent }"
        >{{ (form.name || 'ЖК').replace(/[«»"]/g, '').trim().slice(0, 2).toUpperCase() }}</span>
        <div class="min-w-0">
          <p class="truncate text-[14px] font-semibold text-ink">{{ form.name || 'Название проекта' }}</p>
          <p class="truncate text-[12px] text-muted">
            {{ propertyKinds.find((k) => k.value === form.propertyKind)?.label }}
            <template v-if="form.address"> · {{ form.address }}</template>
          </p>
        </div>
      </div>

      <section class="flex flex-col gap-3.5">
        <p class="text-[11.5px] font-bold uppercase tracking-wide text-muted">Основное</p>

        <div class="flex flex-col gap-1.5 text-[12.5px] font-medium text-muted">
          <span>Тип объекта</span>
          <div class="grid grid-cols-3 gap-1.5">
            <button
              v-for="k in propertyKinds" :key="k.value" type="button"
              class="focus-ring flex flex-col items-center gap-1 rounded-xl2 border px-2 py-2.5 transition-colors"
              :class="form.propertyKind === k.value ? 'border-ink bg-soft text-ink' : 'border-line text-muted hover:border-plum/50'"
              @click="form.propertyKind = k.value"
            >
              <Icon :name="k.icon" size="17" />
              <span class="text-[11.5px] font-semibold">{{ k.label }}</span>
            </button>
          </div>
        </div>

        <AppInput v-model="form.name" label="Название" placeholder="ЖК «Название»" />
        <AppInput v-model="form.address" label="Адрес" placeholder="Город, улица" />
        <AppInput v-model="form.developer" label="Застройщик" />

        <div class="flex flex-col gap-1.5 text-[12.5px] font-medium text-muted">
          <span>Акцентный цвет</span>
          <div class="flex flex-wrap items-center gap-1.5">
            <button
              v-for="c in ACCENTS" :key="c" type="button"
              class="focus-ring h-8 w-8 rounded-lg border-2 transition-transform"
              :class="form.accent.toLowerCase() === c.toLowerCase() ? 'border-ink scale-105' : 'border-transparent'"
              :style="{ background: c }" :title="c" @click="form.accent = c"
            />
            <label class="focus-ring flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-line px-2 text-[11.5px] text-muted">
              <Icon name="ph:eyedropper" size="13" />
              свой
              <input v-model="form.accent" type="color" class="h-5 w-6 cursor-pointer border-0 bg-transparent p-0">
            </label>
          </div>
        </div>
      </section>

      <section class="flex flex-col gap-3.5 border-t border-line pt-4">
        <p class="text-[11.5px] font-bold uppercase tracking-wide text-muted">Продажи и деньги</p>
        <div class="grid grid-cols-2 gap-3">
          <AppSelect v-model="form.currency" label="Валюта" :options="[{ value: 'USD', label: 'USD' }, { value: 'KGS', label: 'KGS (сом)' }]" />
          <AppInput v-model="form.country" label="Страна" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <AppInput v-model="form.stage" label="Стадия строительства" placeholder="Котлован, Строительство…" />
          <AppInput v-model="form.salesStart" type="date" label="Старт продаж" />
        </div>
        <AppSelect
          v-model="form.salesOfficeId" label="Отдел продаж" placeholder="Не выбран"
          :options="settingsStore.salesOffices.map((o) => ({ value: o.id, label: o.name }))"
        />

        <label class="flex flex-col gap-1.5 text-[12.5px] font-medium text-muted">
          <span>Банки (аккредитация)</span>
          <div class="flex flex-wrap gap-1.5 rounded-xl2 border border-line p-2">
            <span v-for="b in form.banks" :key="b" class="flex items-center gap-1 rounded-full bg-soft px-2.5 py-1 text-[12px] font-medium text-ink">
              {{ b }} <button type="button" class="text-muted hover:text-bad" @click="removeBank(b)"><Icon name="ph:x" size="11" /></button>
            </span>
            <input
              v-model="bankInput" placeholder="Добавить и Enter"
              class="min-w-[120px] flex-1 border-0 bg-transparent px-1 py-1 text-[13px] text-ink outline-none"
              @keydown.enter.prevent="addBank"
            >
          </div>
          <span class="text-[11px] font-normal text-muted">Банк из этого списка можно выбрать в договоре и в фильтрах клиентов</span>
        </label>
      </section>

      <section class="flex flex-col gap-3.5 border-t border-line pt-4">
        <p class="text-[11.5px] font-bold uppercase tracking-wide text-muted">Витрина</p>
        <label class="flex flex-col gap-1.5 text-[12.5px] font-medium text-muted">
          <span>Инфраструктура</span>
          <textarea
            v-model="form.infrastructure" rows="3"
            class="focus-ring rounded-xl2 border border-line bg-panel px-3 py-2 text-[14px] font-normal text-ink"
            placeholder="Детский сад, паркинг, двор без машин…"
          />
        </label>
        <AppInput v-model="form.website" label="Сайт" placeholder="https://" />
      </section>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <AppButton @click="close">Отмена</AppButton>
        <AppButton variant="primary" icon="ph:check-bold" @click="submit">{{ project ? 'Сохранить' : 'Создать проект' }}</AppButton>
      </div>
    </template>
  </AppDrawer>
</template>
