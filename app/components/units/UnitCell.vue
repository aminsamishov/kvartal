<script setup lang="ts">
import type { Unit } from '~/types/models'
import { UNIT_BOARD_FILL } from '~/utils/meta'
import { bestPromoForUnit, healthFromBucket, PAYMENT_HEALTH_META } from '~/utils/board'
import { moneyCompact } from '~/utils/format'

/**
 * Ячейка шахматки.
 *
 * Вся информация разложена по строкам сетки, а не наложена поверх номера:
 * бейдж акции раньше садился на номер и комнатность, а процент совпадения —
 * на полосу погашения. Абсолютно позиционируем только два элемента, которые
 * физически не могут пересечься с контентом: полоску выделения на левом
 * ребре и штриховку коммерции на верхнем.
 */
const props = defineProps<{
  unit: Unit
  dim?: boolean
  large?: boolean
  mode: 'status' | 'payment'
  highlighted?: boolean
  /** входит в текущее выделение — общее для шахматки, фасада и плана этажа */
  selected?: boolean
  /** процент совпадения с запросом клиента, когда подбор идёт под заявку */
  score?: number
  /** сколько человек ждёт этот объект */
  queue?: number
}>()
const emit = defineEmits<{ click: [MouseEvent]; hover: [MouseEvent]; move: [MouseEvent]; leave: [] }>()

const dealsStore = useDealsStore()
const settingsStore = useSettingsStore()

const statusFill = computed(() => UNIT_BOARD_FILL[props.unit.status])
const isCommercial = computed(() => props.unit.kind === 'commercial')

const balance = computed(() => (props.unit.contractId ? dealsStore.balance(props.unit.contractId) : null))
const bucket = computed(() => (props.unit.contractId ? dealsStore.paymentBoardBucket(props.unit.contractId) : null))
const health = computed(() => (bucket.value ? healthFromBucket(bucket.value) : null))
const paidPct = computed(() => (balance.value && balance.value.price
  ? Math.min(100, Math.round((balance.value.paid / balance.value.price) * 100))
  : 0))
const hasProgress = computed(() => props.unit.status === 'installment' && !!balance.value)

const promo = computed(() => bestPromoForUnit(props.unit, settingsStore.promotions))
const overdue = computed(() => props.mode === 'status' && health.value === 'bad')

// в режиме «Оплата» красим только объекты в рассрочке по здоровью платежей;
// всё остальное уходит в нейтральный фон, чтобы взгляд цеплялся за долги
const paymentModeClasses = computed(() => {
  if (props.unit.status !== 'installment' || !health.value) {
    return { bg: 'bg-soft', border: 'border-line', text: 'text-muted' }
  }
  const m = PAYMENT_HEALTH_META[health.value]
  return { bg: m.bg, border: m.border, text: m.text }
})

const visual = computed(() => (props.mode === 'payment' ? paymentModeClasses.value : statusFill.value))

/**
 * Нижняя строка компактной ячейки вмещает один знак. Порядок важности:
 * совпадение с запросом клиента (подбор идёт под него) → просрочка → акция →
 * очередь → ключи. Остальное живёт в подсказке при наведении.
 */
const compactBadge = computed(() => {
  if (props.score !== undefined && !props.dim) {
    return {
      text: `${props.score}%`,
      cls: props.score >= 90 ? 'bg-fill-ok text-white' : props.score >= 70 ? 'bg-panel text-ink ring-1 ring-line' : 'bg-panel/70 text-muted',
      title: `Совпадение с запросом клиента — ${props.score}%`,
    }
  }
  if (promo.value) {
    return { text: `−${promo.value.value}%`, cls: 'bg-fill-bad text-white', title: `Акция «${promo.value.name}»` }
  }
  if (props.queue) {
    return { text: `+${props.queue}`, cls: 'bg-warn-bg text-warn', title: `В очереди: ${props.queue}` }
  }
  return null
})
</script>

<template>
  <button
    type="button"
    class="focus-ring group relative flex shrink-0 flex-col overflow-hidden rounded-lg border text-left transition-all duration-150 hover:z-20 hover:-translate-y-[3px] hover:shadow-rise"
    :class="[
      visual.bg, visual.border, visual.text,
      dim ? 'opacity-25 saturate-0 hover:translate-y-0 hover:shadow-none' : '',
      large ? 'h-[92px] w-[132px] gap-1 p-2.5' : 'h-[58px] w-[66px] gap-0.5 p-1.5',
      selected ? 'ring-2 ring-ink ring-offset-1 ring-offset-bg' : highlighted && !dim ? 'ring-2 ring-plum ring-offset-1 ring-offset-bg' : '',
    ]"
    @click="emit('click', $event)"
    @mouseenter="emit('hover', $event)"
    @mousemove="emit('move', $event)"
    @mouseleave="emit('leave')"
  >
    <!-- коммерция: штриховка на верхнем ребре -->
    <span
      v-if="isCommercial"
      class="pointer-events-none absolute inset-x-0 top-0 h-[3px] opacity-40"
      :style="{ backgroundImage: 'repeating-linear-gradient(90deg, currentColor 0 6px, transparent 6px 10px)' }"
    />
    <!-- выделение: полоса на левом ребре, поверх неё ничего не рисуется -->
    <span v-if="selected" class="pointer-events-none absolute inset-y-0 left-0 w-[3px] bg-ink" />

    <!-- строка 1: номер, комнатность, признак просрочки -->
    <span class="flex items-baseline justify-between gap-1 leading-none">
      <span class="tabular truncate font-bold" :class="large ? 'text-[15px]' : 'text-[12px]'">{{ unit.number }}</span>
      <span class="flex shrink-0 items-center gap-1">
        <span
          v-if="overdue" class="h-[6px] w-[6px] rounded-full bg-board-bad ring-1 ring-white/70"
          title="Просрочка платежа"
        />
        <Icon v-if="unit.keysIssued" name="ph:key-fill" :size="large ? 12 : 10" class="opacity-70" title="Ключи выданы" />
        <span v-if="unit.rooms" class="font-semibold opacity-70" :class="large ? 'text-[10.5px]' : 'text-[9px]'">
          {{ unit.rooms }}{{ large ? ' комн.' : '' }}
        </span>
      </span>
    </span>

    <!-- крупный режим: площадь и цена отдельными строками -->
    <template v-if="large">
      <span class="text-[10.5px] font-medium leading-none opacity-80">{{ unit.area }} м²</span>
      <span class="tabular text-[13px] font-bold leading-none">{{ moneyCompact(unit.price) }}</span>
      <span class="mt-auto flex items-center gap-1">
        <span
          v-if="compactBadge" class="rounded px-1 py-px text-[9.5px] font-bold leading-none"
          :class="compactBadge.cls" :title="compactBadge.title"
        >{{ compactBadge.text }}</span>
        <span v-if="promo && score !== undefined" class="rounded bg-fill-bad px-1 py-px text-[9.5px] font-bold leading-none text-white" :title="promo.name">
          −{{ promo.value }}%
        </span>
        <span v-if="hasProgress" class="tabular ml-auto text-[9.5px] font-semibold opacity-80">{{ paidPct }}%</span>
      </span>
    </template>

    <!-- компактный режим: один знак в нижней строке -->
    <span v-else class="mt-auto flex items-end gap-1">
      <span
        v-if="compactBadge" class="rounded px-1 text-[9px] font-bold leading-[13px]"
        :class="compactBadge.cls" :title="compactBadge.title"
      >{{ compactBadge.text }}</span>
    </span>

    <!-- погашение: полоса всегда в своей строке, ничем не перекрыта -->
    <span v-if="hasProgress" class="h-[3px] w-full shrink-0 overflow-hidden rounded-full bg-white/25">
      <span class="block h-full rounded-full bg-white" :style="{ width: `${paidPct}%` }" />
    </span>
  </button>
</template>
