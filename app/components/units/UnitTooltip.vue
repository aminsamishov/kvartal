<script setup lang="ts">
import type { Unit } from '~/types/models'
import { UNIT_KIND_META, UNIT_STATUS_META } from '~/utils/meta'
import { area as fmtArea, money } from '~/utils/format'
import { bestPromoForUnit } from '~/utils/board'

const props = defineProps<{ unit: Unit | null; x: number; y: number }>()
const settingsStore = useSettingsStore()

const promo = computed(() => (props.unit ? bestPromoForUnit(props.unit, settingsStore.promotions) : null))
const finalPrice = computed(() => (props.unit && promo.value ? Math.round(props.unit.price * (1 - promo.value.value / 100)) : props.unit?.price ?? 0))

const style = computed(() => {
  const pad = 16
  const w = 220
  const vw = import.meta.client ? window.innerWidth : 1280
  const vh = import.meta.client ? window.innerHeight : 800
  let left = props.x + 18
  let top = props.y + 18
  if (left + w + pad > vw) left = props.x - w - 18
  if (top + 140 + pad > vh) top = vh - 140 - pad
  return { left: `${left}px`, top: `${top}px` }
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="unit" class="pointer-events-none fixed z-[80] w-[220px] rounded-xl2 border border-line bg-panel p-3.5 shadow-panel"
      :style="style"
    >
      <p class="text-[14px] font-semibold tracking-[-0.015em]">№ {{ unit.number }} <span class="font-sans text-[12px] font-normal text-muted">· {{ UNIT_KIND_META[unit.kind].label }}</span></p>
      <div class="mt-2 flex flex-col gap-1 text-[12.5px]">
        <div class="flex justify-between"><span class="text-muted">Статус</span><StatusTag :tone="UNIT_STATUS_META[unit.status].tone" size="sm">{{ UNIT_STATUS_META[unit.status].label }}</StatusTag></div>
        <div class="flex justify-between"><span class="text-muted">Площадь</span><span class="tabular font-medium">{{ fmtArea(unit.area) }}</span></div>
        <div v-if="unit.rooms" class="flex justify-between"><span class="text-muted">Комнат</span><span class="tabular font-medium">{{ unit.rooms }}</span></div>
        <div class="flex justify-between"><span class="text-muted">Цена</span><span class="tabular font-semibold">{{ money(finalPrice) }}</span></div>
        <div v-if="promo" class="flex justify-between text-bad"><span>Акция «{{ promo.name }}»</span><span class="font-semibold">−{{ promo.value }}%</span></div>
      </div>
    </div>
  </Teleport>
</template>
