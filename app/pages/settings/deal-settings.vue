<script setup lang="ts">
definePageMeta({ breadcrumb: [{ label: 'Настройки', to: '/settings' }, { label: 'Настройки Мастера сделок' }] })

const settingsStore = useSettingsStore()
const ui = useUiStore()

const availableFields = ['ФИО', 'Телефон', 'Паспорт', 'Адрес регистрации', 'Email', 'Доверенность']

function toggleField(list: string[], field: string) {
  const i = list.indexOf(field)
  if (i === -1) list.push(field)
  else list.splice(i, 1)
}

function save() {
  ui.toast('Настройки мастера сделок сохранены', 'ok')
}
</script>

<template>
  <SettingsShell title="Настройки Мастера сделок" subtitle="Порядок расчёта скидок и обязательные поля покупателя">
    <div class="flex flex-col gap-5">
      <AppCard title="Порядок расчёта скидок и наценок">
        <div class="flex flex-col gap-2">
          <label class="flex items-center gap-2.5 rounded-xl2 border border-line px-3.5 py-2.5 text-[13px] has-[:checked]:border-plum has-[:checked]:bg-plum-soft">
            <input v-model="settingsStore.dealSettings.discountOrder" type="radio" value="independent" class="accent-plum">
            Независимый расчёт — скидки и акции применяются к базовой цене по отдельности (по умолчанию)
          </label>
          <label class="flex items-center gap-2.5 rounded-xl2 border border-line px-3.5 py-2.5 text-[13px] has-[:checked]:border-plum has-[:checked]:bg-plum-soft">
            <input v-model="settingsStore.dealSettings.discountOrder" type="radio" value="sequential" class="accent-plum">
            Последовательный расчёт — каждая следующая скидка применяется к уже сниженной цене
          </label>
        </div>
      </AppCard>

      <AppCard title="Обязательные поля покупателя">
        <div class="flex flex-wrap gap-2">
          <Chip v-for="f in availableFields" :key="f" :pressed="settingsStore.dealSettings.requireClientFields.includes(f)" @click="toggleField(settingsStore.dealSettings.requireClientFields, f)">{{ f }}</Chip>
        </div>
      </AppCard>

      <AppCard title="Обязательные поля представителя покупателя">
        <div class="flex flex-wrap gap-2">
          <Chip v-for="f in availableFields" :key="f" :pressed="settingsStore.dealSettings.requireRepFields.includes(f)" @click="toggleField(settingsStore.dealSettings.requireRepFields, f)">{{ f }}</Chip>
        </div>
      </AppCard>

      <AppButton variant="primary" class="w-fit" @click="save">Сохранить</AppButton>
    </div>
  </SettingsShell>
</template>
