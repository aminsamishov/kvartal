<script setup lang="ts">
import { money } from '~/utils/format'

definePageMeta({ breadcrumb: [{ label: 'Настройки', to: '/settings' }, { label: 'Опции' }] })

const settingsStore = useSettingsStore()
const unitsStore = useUnitsStore()
const ui = useUiStore()

const showCreate = ref(false)
const form = reactive({ name: '', price: 1000 })
function create() {
  if (!form.name.trim()) return
  settingsStore.addOption({ ...form, active: true, projectIds: unitsStore.projects.map((p) => p.id) })
  ui.toast('Опция добавлена', 'ok')
  showCreate.value = false
  form.name = ''
}
</script>

<template>
  <SettingsShell title="Опции" subtitle="Дополнительные позиции: кладовая, машиноместо, отделка — для допродаж в мастере сделок">
    <div class="flex flex-col gap-3.5">
      <div class="flex justify-end"><AppButton variant="primary" icon="ph:plus-bold" @click="showCreate = true">Новая опция</AppButton></div>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div v-for="o in settingsStore.unitOptions" :key="o.id" class="flex items-center justify-between rounded-card border border-line bg-panel p-4">
          <div>
            <p class="text-[13.5px] font-semibold">{{ o.name }}</p>
            <p class="tabular mt-0.5 text-[12.5px] text-muted">{{ money(o.price) }}</p>
          </div>
          <button @click="settingsStore.toggleOption(o.id)">
            <StatusTag :tone="o.active ? 'ok' : 'neutral'" size="sm" dot>{{ o.active ? 'Активна' : 'Отключена' }}</StatusTag>
          </button>
        </div>
      </div>
    </div>

    <AppModal v-model="showCreate" title="Новая опция">
      <div class="flex flex-col gap-3.5">
        <AppInput v-model="form.name" label="Название" />
        <AppInput v-model.number="form.price" type="number" label="Цена, $" />
        <AppButton variant="primary" block @click="create">Добавить</AppButton>
      </div>
    </AppModal>
  </SettingsShell>
</template>
