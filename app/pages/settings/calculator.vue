<script setup lang="ts">
definePageMeta({ breadcrumb: [{ label: 'Настройки', to: '/settings' }, { label: 'Калькулятор условий покупки' }] })

const settingsStore = useSettingsStore()
const ui = useUiStore()

function save() {
  ui.toast('Настройки калькулятора сохранены', 'ok')
}
</script>

<template>
  <SettingsShell title="Калькулятор условий покупки" subtitle="Подбирает способ покупки по параметрам покупателя в мастере сделок и на витрине">
    <AppCard>
      <label class="flex items-center justify-between gap-3 rounded-xl2 bg-soft px-4 py-3.5">
        <span>
          <span class="block text-[13.5px] font-semibold">Отображать калькулятор в Мастере сделки и виджете CRM</span>
          <span class="mt-0.5 block text-[12px] text-muted">Требует, чтобы у способов оплаты «Ипотека»/«Рассрочка» были заполнены обязательные поля</span>
        </span>
        <input v-model="settingsStore.calculatorEnabled" type="checkbox" class="h-5 w-5 accent-plum">
      </label>

      <div class="mt-4">
        <p class="mb-2 text-[12.5px] font-semibold">Способы оплаты, участвующие в расчёте</p>
        <div class="flex flex-col gap-2">
          <div v-for="m in settingsStore.paymentMethods" :key="m.id" class="flex items-center justify-between rounded-xl2 border border-line px-3.5 py-2.5">
            <span class="text-[13px]">{{ m.name }}</span>
            <StatusTag v-if="m.kind !== 'full' && !m.affectsPrice" tone="ok" size="sm">В расчёте</StatusTag>
            <StatusTag v-else tone="neutral" size="sm">Не участвует</StatusTag>
          </div>
        </div>
      </div>

      <AppButton class="mt-4" variant="primary" @click="save">Сохранить</AppButton>
    </AppCard>
  </SettingsShell>
</template>
