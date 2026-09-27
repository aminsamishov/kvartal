<script setup lang="ts">
import type { Unit } from '~/types/models'
import { UNIT_BOARD_FILL } from '~/utils/meta'
import { bestPromoForUnit, healthFromBucket, PAYMENT_HEALTH_META } from '~/utils/board'

const props = defineProps<{
  unit: Unit
  dim?: boolean
  large?: boolean
  mode: 'status' | 'payment'
  highlighted?: boolean
}>()
const emit = defineEmits<{ click: []; hover: [MouseEvent]; move: [MouseEvent]; leave: [] }>()

const dealsStore = useDealsStore()
const settingsStore = useSettingsStore()

const statusFill = computed(() => UNIT_BOARD_FILL[props.unit.status])
const isCommercial = computed(() => props.unit.kind === 'commercial')

const balance = computed(() => (props.unit.contractId ? dealsStore.balance(props.unit.contractId) : null))
const bucket = computed(() => (props.unit.contractId ? dealsStore.paymentBoardBucket(props.unit.contractId) : null))
const health = computed(() => (bucket.value ? healthFromBucket(bucket.value) : null))
const paidPct = computed(() => (balance.value && balance.value.price ? Math.min(100, Math.round((balance.value.paid / balance.value.price) * 100)) : 0))

const promo = computed(() => bestPromoForUnit(props.unit, settingsStore.promotions))

// в режиме "Оплата" красим только объекты в рассрочке по здоровью платежей;
// всё остальное уходит в нейтральный фон, чтобы взгляд цеплялся за долги
const paymentModeClasses = computed(() => {
  if (props.unit.status !== 'installment' || !health.value) {
    return { bg: 'bg-soft', border: 'border-line', text: 'text-muted' }
  }
  const m = PAYMENT_HEALTH_META[health.value]
  return { bg: m.bg, border: m.border, text: m.text }
})

const visual = computed(() => (props.mode === 'payment' ? paymentModeClasses.value : statusFill.value))
</script>

<template>
  <button
    type="button"
    class="focus-ring group relative flex shrink-0 flex-col justify-between overflow-hidden rounded-lg border text-left transition-all duration-150 hover:z-20 hover:-translate-y-[3px] hover:shadow-rise"
    :class="[
      visual.bg, visual.border, visual.text,
      dim ? 'opacity-25 saturate-0 hover:translate-y-0 hover:shadow-none' : '',
      large ? 'h-[92px] w-[132px] p-2.5' : 'h-[58px] w-[66px] p-1.5',
      highlighted && !dim ? 'ring-2 ring-plum ring-offset-1 ring-offset-bg' : '',
    ]"
    @click="emit('click')"
    @mouseenter="emit('hover', $event)"
    @mousemove="emit('move', $event)"
    @mouseleave="emit('leave')"
  >
    <span v-if="isCommercial" class="pointer-events-none absolute inset-x-0 top-0 h-[3px] opacity-40" :style="{ backgroundImage: 'repeating-linear-gradient(90deg, currentColor 0 6px, transparent 6px 10px)' }" />

    <span
      v-if="unit.status === 'free' && promo" class="absolute right-1 top-1 rounded px-1 py-px text-[9px] font-bold text-white"
      style="background:#E24B6A" :title="promo.name"
    >−{{ promo.value }}%</span>
    <span v-else-if="mode === 'status' && health === 'bad'" class="absolute right-1.5 top-1.5 h-[7px] w-[7px] rounded-full bg-board-bad ring-2 ring-white/80" title="Просрочка платежа" />
    <Icon v-if="unit.keysIssued" name="ph:key-fill" size="11" class="absolute bottom-1.5 right-1.5 opacity-70" />

    <span class="flex items-start justify-between gap-1">
      <span class="font-bold tabular leading-none" :class="large ? 'text-[15px]' : 'text-[12px]'">{{ unit.number }}</span>
      <span v-if="!large && unit.rooms" class="text-[9px] font-semibold leading-none opacity-60">{{ unit.rooms }}</span>
    </span>

    <template v-if="large">
      <span class="text-[10.5px] font-medium leading-tight opacity-80">{{ unit.rooms ? `${unit.rooms}-комн. · ${unit.area} м²` : `${unit.area} м²` }}</span>
      <span class="tabular text-[13px] font-bold leading-none">{{ Math.round(unit.price / 1000) }} тыс $</span>
    </template>

    <span v-if="unit.status === 'installment' && balance" class="h-[3px] w-full overflow-hidden rounded-full bg-white/25">
      <span class="block h-full rounded-full bg-white" :style="{ width: `${paidPct}%` }" />
    </span>
  </button>
</template>
