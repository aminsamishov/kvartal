<script setup lang="ts">
definePageMeta({ breadcrumb: [{ label: 'Настройки', to: '/settings' }, { label: 'Акции' }] })

const settingsStore = useSettingsStore()
const unitsStore = useUnitsStore()
const ui = useUiStore()

const scopeLabel = { unit_type: 'Тип планировки', unit_kind: 'Вид объекта', floor_level: 'Этаж', block: 'Дом', units: 'Список объектов' } as const

const showCreate = ref(false)
const form = reactive({ name: '', scope: 'unit_kind' as keyof typeof scopeLabel, value: 5, isPercent: true, public: true })
function create() {
  if (!form.name.trim()) return
  settingsStore.addPromotion({ ...form, active: true, projectIds: unitsStore.projects.map((p) => p.id) })
  ui.toast('Акция добавлена', 'ok')
  showCreate.value = false
  form.name = ''
}
</script>

<template>
  <SettingsShell title="Акции" subtitle="Скидки и спецусловия, применяемые к объектам или типам помещений">
    <div class="flex flex-col gap-3.5">
      <div class="flex justify-end"><AppButton variant="primary" icon="ph:plus-bold" @click="showCreate = true">Новая акция</AppButton></div>
      <div class="overflow-x-auto rounded-card border border-line">
        <table class="data-table">
          <thead><tr><th>Название</th><th>Область действия</th><th>Значение</th><th>Публичная</th><th>Статус</th></tr></thead>
          <tbody>
            <tr v-for="p in settingsStore.promotions" :key="p.id">
              <td class="font-medium">{{ p.name }}</td>
              <td>{{ scopeLabel[p.scope] }}</td>
              <td class="tabular">{{ p.value }}{{ p.isPercent ? '%' : ' у.е.' }}</td>
              <td>{{ p.public ? 'Да' : 'Нет' }}</td>
              <td>
                <button @click="settingsStore.togglePromotion(p.id)">
                  <StatusTag :tone="p.active ? 'ok' : 'neutral'" size="sm" dot>{{ p.active ? 'Активна' : 'Отключена' }}</StatusTag>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <AppModal v-model="showCreate" title="Новая акция">
      <div class="flex flex-col gap-3.5">
        <AppInput v-model="form.name" label="Название" />
        <AppSelect v-model="form.scope" label="Область действия" :options="Object.entries(scopeLabel).map(([v, l]) => ({ value: v, label: l }))" />
        <AppInput v-model.number="form.value" type="number" label="Значение" />
        <label class="flex items-center gap-2 text-[13px]"><input v-model="form.isPercent" type="checkbox" class="accent-plum"> В процентах</label>
        <label class="flex items-center gap-2 text-[13px]"><input v-model="form.public" type="checkbox" class="accent-plum"> Публичная</label>
        <AppButton variant="primary" block @click="create">Добавить</AppButton>
      </div>
    </AppModal>
  </SettingsShell>
</template>
