<script setup lang="ts">
import { UNIT_STATUS_META } from '~/utils/meta'
import type { UnitStatus } from '~/types/models'

definePageMeta({ breadcrumb: [{ label: 'Настройки', to: '/settings' }, { label: 'Статусы' }] })

const settingsStore = useSettingsStore()
const ui = useUiStore()
const statuses = Object.entries(UNIT_STATUS_META) as [UnitStatus, typeof UNIT_STATUS_META[UnitStatus]][]

function save() {
  ui.toast('Настройки брони сохранены', 'ok')
}
</script>

<template>
  <SettingsShell title="Статусы" subtitle="Статусы объектов считаются из фактов (график и платежи), не проставляются вручную">
    <div class="flex flex-col gap-6">
      <div class="overflow-x-auto rounded-card border border-line">
        <table class="data-table">
          <thead><tr><th>Статус</th><th>Как считается</th></tr></thead>
          <tbody>
            <tr v-for="[key, meta] in statuses" :key="key">
              <td><StatusTag :tone="meta.tone" dot>{{ meta.label }}</StatusTag></td>
              <td class="text-muted">
                <template v-if="key === 'free'">Нет активной брони и договора</template>
                <template v-else-if="key === 'reserved'">Есть активная запись в reservations</template>
                <template v-else-if="key === 'installment'">Есть активный договор с непогашенным остатком</template>
                <template v-else-if="key === 'sold'">Договор оплачен полностью</template>
                <template v-else>Объект закрыт для продаж вручную</template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <AppCard title="Бронирование и очередь" subtitle="Сроки автоснятия и автопередача следующему в очереди — по опыту АСБ и Profitbase">
        <div class="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
          <AppInput v-model.number="settingsStore.reservationSettings.noDepositDays" type="number" label="Без задатка, дней" />
          <AppInput v-model.number="settingsStore.reservationSettings.confirmedDays" type="number" label="С подтверждением, дней" />
          <AppInput v-model.number="settingsStore.reservationSettings.depositDays" type="number" label="С задатком, дней" />
        </div>
        <AppInput v-model.number="settingsStore.reservationSettings.minDeposit" type="number" label="Минимальный задаток, сом" class="mt-3.5 max-w-xs" />
        <div class="mt-4 flex flex-col gap-2.5">
          <label class="flex items-center gap-2.5 text-[13px]">
            <input v-model="settingsStore.reservationSettings.autoQueueTransfer" type="checkbox" class="accent-plum">
            Автоматически передавать объект следующему в очереди при отказе или истечении брони
          </label>
          <label class="flex items-center gap-2.5 text-[13px]">
            <input v-model="settingsStore.reservationSettings.clearQueueOnConvert" type="checkbox" class="accent-plum">
            Очищать очередь после перевода брони в договор
          </label>
        </div>
        <AppButton class="mt-4" variant="primary" @click="save">Сохранить</AppButton>
      </AppCard>
    </div>
  </SettingsShell>
</template>
