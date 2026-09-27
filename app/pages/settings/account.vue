<script setup lang="ts">
definePageMeta({ breadcrumb: [{ label: 'Настройки', to: '/settings' }, { label: 'Настройки аккаунта' }] })

const settingsStore = useSettingsStore()
const unitsStore = useUnitsStore()
const ui = useUiStore()

function save() {
  ui.toast('Настройки аккаунта сохранены', 'ok')
}
</script>

<template>
  <SettingsShell title="Настройки аккаунта" subtitle="Страна компании определяет набор полей в мастере сделок и в документах">
    <div class="flex flex-col gap-5">
      <AppCard title="Компания">
        <div class="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <AppInput label="Название компании" model-value="ОсОО «Кварталстрой»" />
          <AppSelect v-model="settingsStore.accountCountry" label="Страна компании" :options="[{ value: 'Кыргызстан', label: 'Кыргызстан' }, { value: 'Казахстан', label: 'Казахстан' }, { value: 'Узбекистан', label: 'Узбекистан' }]" />
          <AppSelect v-model="settingsStore.accountCurrency" label="Основная валюта" :options="[{ value: 'USD', label: 'USD' }, { value: 'KGS', label: 'KGS (сом)' }]" />
          <AppInput label="Номер WhatsApp для напоминаний" placeholder="+996 700 000 000" />
        </div>
      </AppCard>

      <AppCard title="Проекты в аккаунте" subtitle="Одна база, много проектов">
        <div class="flex flex-col gap-2">
          <div v-for="p in unitsStore.projects" :key="p.id" class="flex items-center justify-between rounded-xl2 border border-line px-3.5 py-2.5">
            <span class="flex items-center gap-2 text-[13px]"><span class="h-2 w-2 rounded-full" :style="{ background: p.accent }" /> {{ p.name }}</span>
            <span class="text-[12px] text-muted">{{ p.currency }} · {{ p.country }}</span>
          </div>
        </div>
      </AppCard>

      <AppCard title="Юридические лица" subtitle="Продавец в договорах и документах">
        <EmptyState compact icon="ph:buildings" title="Юрлица пока не добавлены" text="Добавьте юрлицо, чтобы указывать его в договорах и печатных формах">
          <template #action><AppButton size="sm" variant="primary" icon="ph:plus-bold">Добавить юрлицо</AppButton></template>
        </EmptyState>
      </AppCard>

      <AppButton variant="primary" class="w-fit" @click="save">Сохранить</AppButton>
    </div>
  </SettingsShell>
</template>
