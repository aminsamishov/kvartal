<script setup lang="ts">
definePageMeta({ breadcrumb: [{ label: 'Настройки', to: '/settings' }, { label: 'Способы оплаты' }] })

const settingsStore = useSettingsStore()
const unitsStore = useUnitsStore()
const ui = useUiStore()

const kindLabel = { full: '100% оплата', installment: 'Рассрочка', mortgage: 'Ипотека' } as const

const showCreate = ref(false)
const form = reactive({ name: '', kind: 'installment' as keyof typeof kindLabel, public: true, affectsPrice: false })
function create() {
  if (!form.name.trim()) return
  settingsStore.addPaymentMethod({ ...form, active: true, projectIds: unitsStore.projects.map((p) => p.id) })
  ui.toast('Способ оплаты добавлен', 'ok')
  showCreate.value = false
  form.name = ''
}
</script>

<template>
  <SettingsShell title="Способы оплаты" subtitle="100% оплата, рассрочка, ипотека — что доступно покупателю в мастере сделок">
    <div class="flex flex-col gap-3.5">
      <div class="flex justify-end"><AppButton variant="primary" icon="ph:plus-bold" @click="showCreate = true">Добавить способ</AppButton></div>
      <div class="overflow-x-auto rounded-card border border-line">
        <table class="data-table">
          <thead><tr><th>Название</th><th>Вид</th><th>Публичный</th><th>Влияет на цену</th><th>Статус</th></tr></thead>
          <tbody>
            <tr v-for="m in settingsStore.paymentMethods" :key="m.id">
              <td class="font-medium">{{ m.name }}</td>
              <td>{{ kindLabel[m.kind] }}</td>
              <td>{{ m.public ? 'Да' : 'Нет' }}</td>
              <td>{{ m.affectsPrice ? 'Да' : 'Нет' }}</td>
              <td>
                <button @click="settingsStore.togglePaymentMethod(m.id)">
                  <StatusTag :tone="m.active ? 'ok' : 'neutral'" size="sm" dot>{{ m.active ? 'Активен' : 'Отключён' }}</StatusTag>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <AppModal v-model="showCreate" title="Новый способ оплаты">
      <div class="flex flex-col gap-3.5">
        <AppInput v-model="form.name" label="Название" />
        <AppSelect v-model="form.kind" label="Вид" :options="Object.entries(kindLabel).map(([v, l]) => ({ value: v, label: l }))" />
        <label class="flex items-center gap-2 text-[13px]"><input v-model="form.public" type="checkbox" class="accent-plum"> Публичный (виден на сайте)</label>
        <label class="flex items-center gap-2 text-[13px]"><input v-model="form.affectsPrice" type="checkbox" class="accent-plum"> Влияет на итоговую цену</label>
        <AppButton variant="primary" block @click="create">Добавить</AppButton>
      </div>
    </AppModal>
  </SettingsShell>
</template>
