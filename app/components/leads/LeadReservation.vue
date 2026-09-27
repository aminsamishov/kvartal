<script setup lang="ts">
import type { Lead } from '~/types/models'
import { RESERVATION_KIND_META } from '~/utils/meta'
import { fmtDate, money } from '~/utils/format'

const props = defineProps<{ lead: Lead }>()
const emit = defineEmits<{ contract: [string] }>()

const salesStore = useSalesStore()
const unitsStore = useUnitsStore()
const settingsStore = useSettingsStore()
const auth = useAuthStore()
const ui = useUiStore()

const reservation = computed(() => salesStore.activeReservationForLead(props.lead.id))
const unit = computed(() => (reservation.value ? unitsStore.unit(reservation.value.unitId) : undefined))
const author = computed(() => settingsStore.users.find((u) => u.id === reservation.value?.createdBy)?.name
  ?? reservation.value?.createdBy ?? '—')
const past = computed(() => salesStore.reservationsForLead(props.lead.id).filter((r) => r.status !== 'active'))

function extend(days: number) {
  if (!reservation.value) return
  salesStore.extendReservation(reservation.value.id, days, auth.user?.name ?? 'Система')
  ui.toast(`Бронь продлена на ${days} дн.`, 'ok')
}
async function release() {
  if (!reservation.value) return
  await salesStore.cancelReservation(reservation.value.id)
  ui.toast('Бронь снята, объект освобождён', 'info')
}
</script>

<template>
  <AppCard id="sec-reserve" :padded="false">
    <div class="flex items-center justify-between gap-3 px-4 pt-4">
      <h3 class="text-[13px] font-semibold uppercase tracking-[0.04em] text-muted">Бронь</h3>
      <StatusTag v-if="reservation" tone="warn" size="sm" dot>Активна</StatusTag>
    </div>

    <div class="p-4">
      <template v-if="reservation && unit">
        <div class="rounded-xl2 border border-reserve bg-reserve-bg p-3">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="tabular text-[15px] font-semibold text-ink">№ {{ unit.number }}</p>
              <p class="mt-0.5 text-[12px] text-muted">
                {{ unitsStore.building(unit.buildingId)?.name }} · эт. {{ unit.floor }} · {{ unit.rooms || '—' }} комн.
              </p>
            </div>
            <p class="tabular shrink-0 text-[15px] font-semibold text-ink">{{ money(unit.price) }}</p>
          </div>

          <div class="mt-3">
            <CountdownBadge :until="reservation.expiresAt" :from="reservation.createdAt" />
          </div>

          <p class="mt-2.5 text-[11.5px] text-muted">
            {{ RESERVATION_KIND_META[reservation.kind].label }} · забронировал {{ author }} · {{ fmtDate(reservation.createdAt) }}
            <template v-if="reservation.deposit"> · задаток {{ money(reservation.deposit, 'KGS') }}</template>
          </p>
        </div>

        <div class="mt-3 flex flex-wrap gap-1.5">
          <AppButton size="sm" icon="ph:clock-clockwise" @click="extend(3)">+3 дня</AppButton>
          <AppButton size="sm" icon="ph:clock-clockwise" @click="extend(7)">+неделя</AppButton>
          <AppButton size="sm" variant="danger" icon="ph:x-circle" @click="release">Снять бронь</AppButton>
          <AppButton size="sm" variant="primary" icon="ph:file-text" class="ml-auto" @click="emit('contract', unit!.id)">Создать договор</AppButton>
        </div>
      </template>

      <p v-else class="flex items-center gap-2 rounded-xl2 border border-dashed border-line px-3 py-2.5 text-[12.5px] text-muted">
        <Icon name="ph:bookmark-simple" size="15" /> Активной брони нет — забронируйте из списка подбора
      </p>

      <div v-if="past.length" class="mt-3">
        <p class="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted">Прошлые брони</p>
        <div class="flex flex-col gap-1">
          <div v-for="r in past" :key="r.id" class="flex items-center gap-2 rounded-lg bg-soft px-2.5 py-1.5 text-[12px]">
            <span class="tabular font-medium">№ {{ unitsStore.unit(r.unitId)?.number ?? '—' }}</span>
            <span class="text-muted">{{ fmtDate(r.createdAt) }}</span>
            <StatusTag size="sm" :tone="r.status === 'converted' ? 'ok' : 'neutral'" class="ml-auto">
              {{ r.status === 'converted' ? 'В договоре' : r.status === 'expired' ? 'Истекла' : 'Снята' }}
            </StatusTag>
          </div>
        </div>
      </div>
    </div>
  </AppCard>
</template>
