<script setup lang="ts">
import type { Unit } from '~/types/models'
import { UNIT_KIND_META, UNIT_STATUS_META } from '~/utils/meta'
import { area as fmtArea, money } from '~/utils/format'
import { bestPromoForUnit } from '~/utils/board'
import type { MatchedUnit } from '~/composables/useLeadMatching'

const props = defineProps<{ unit: Unit | null; x: number; y: number; score?: MatchedUnit }>()
const settingsStore = useSettingsStore()
const unitsStore = useUnitsStore()

// очередь на занятый объект — сигнал «торопись», его нельзя прятать в карточке
const queue = computed(() => (props.unit ? unitsStore.queueFor(props.unit.id).length : 0))

const promo = computed(() => (props.unit ? bestPromoForUnit(props.unit, settingsStore.promotions) : null))
const finalPrice = computed(() => (props.unit && promo.value ? Math.round(props.unit.price * (1 - promo.value.value / 100)) : props.unit?.price ?? 0))

const style = computed(() => {
  const pad = 16
  const w = 220
  const vw = import.meta.client ? window.innerWidth : 1280
  const vh = import.meta.client ? window.innerHeight : 800
  let left = props.x + 18
  let top = props.y + 18
  // с разбивкой совпадения подсказка выше — иначе она уезжает за нижний край
  const h = props.score ? 280 : 140
  if (left + w + pad > vw) left = props.x - w - 18
  if (top + h + pad > vh) top = Math.max(pad, vh - h - pad)
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
        <div v-if="queue" class="flex justify-between text-warn"><span>В очереди</span><span class="tabular font-semibold">{{ queue }}</span></div>
      </div>

      <!-- разбивка совпадения: менеджер должен видеть, за что снят процент -->
      <div v-if="score" class="mt-2 border-t border-line pt-2">
        <p class="flex items-center justify-between text-[12px]">
          <span class="text-muted">Совпадение с запросом</span>
          <b class="tabular text-[13px] text-plum">{{ score.score }}%</b>
        </p>
        <div class="mt-1 flex flex-col gap-0.5">
          <p v-for="f in score.factors" :key="f.key" class="flex items-center gap-1.5 text-[11px]">
            <Icon :name="f.ok ? 'ph:check-circle-fill' : 'ph:minus-circle-fill'" size="11" :class="f.ok ? 'text-ok' : 'text-warn'" />
            <span class="min-w-0 flex-1 truncate text-muted">{{ f.detail }}</span>
          </p>
        </div>
      </div>
    </div>
  </Teleport>
</template>
