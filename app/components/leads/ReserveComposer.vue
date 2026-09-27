<script setup lang="ts">
import type { ReservationKind } from '~/types/models'
import { RESERVATION_KIND_META } from '~/utils/meta'
import { money } from '~/utils/format'

const props = defineProps<{ leadId: string; unitId: string }>()
const emit = defineEmits<{ done: []; cancel: [] }>()

const salesStore = useSalesStore()
const unitsStore = useUnitsStore()
const settingsStore = useSettingsStore()
const auth = useAuthStore()
const ui = useUiStore()

const unit = computed(() => unitsStore.unit(props.unitId))
const kind = ref<ReservationKind>('with_deposit')
const deposit = ref(settingsStore.reservationSettings.minDeposit)

watch(kind, (k) => { deposit.value = k === 'with_deposit' ? settingsStore.reservationSettings.minDeposit : 0 })

async function submit() {
  await salesStore.reserveFromLead(props.leadId, props.unitId, kind.value, deposit.value, auth.user?.name ?? 'Система')
  ui.toast(`№ ${unit.value?.number} забронирована`, 'ok')
  emit('done')
}
</script>

<template>
  <div class="flex flex-col gap-3 rounded-xl2 border border-plum bg-plum-soft/40 p-3">
    <p class="text-[12.5px] font-semibold">Бронь № {{ unit?.number }} · {{ unit ? money(unit.price) : '' }}</p>
    <div class="flex flex-col gap-1.5">
      <label
        v-for="(meta, key) in RESERVATION_KIND_META" :key="key"
        class="flex cursor-pointer items-center gap-2 rounded-xl2 border border-line bg-panel px-3 py-2 text-[12.5px] has-[:checked]:border-plum"
      >
        <input v-model="kind" type="radio" :value="key" class="accent-plum">
        {{ meta.label }} <span class="text-muted">— {{ meta.days }} {{ meta.days === 1 ? 'день' : meta.days < 5 ? 'дня' : 'дней' }}</span>
      </label>
    </div>
    <AppInput v-if="kind === 'with_deposit'" v-model.number="deposit" type="number" label="Задаток" suffix="сом" />
    <div class="flex gap-2">
      <AppButton block @click="emit('cancel')">Отмена</AppButton>
      <AppButton block variant="primary" icon="ph:bookmark-simple" @click="submit">Забронировать</AppButton>
    </div>
  </div>
</template>
