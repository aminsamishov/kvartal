<script setup lang="ts">
// Столбцы по месяцам. Один ряд за раз — переключатель меры снаружи: двух шкал
// на одном полотне не бывает, иначе график «изобретает» корреляцию.
// Высота контейнера включает полосу подписей оси, чтобы карточка не получала
// собственный вертикальный скролл.
export interface ColumnPoint {
  label: string
  value: number
  /** подпись для подсказки, если нужно не просто число */
  display?: string
  muted?: boolean
}

const props = withDefaults(defineProps<{
  points: ColumnPoint[]
  height?: number
  formatValue?: (v: number) => string
  /** подпись оси Y для табличного вида */
  valueLabel?: string
}>(), { height: 200, valueLabel: 'Значение' })

const fmt = (v: number) => (props.formatValue ? props.formatValue(v) : v.toLocaleString('ru-RU'))

const max = computed(() => Math.max(1, ...props.points.map((p) => p.value)))

/**
 * «Круглые» деления оси: они несут значения, которые не подписаны напрямую.
 * Верх шкалы поднимаем до следующего деления над максимумом — иначе самый
 * высокий столбец упирается в потолок и его подпись уходит за полотно.
 */
const scale = computed(() => {
  const m = max.value
  const pow = 10 ** Math.floor(Math.log10(m))
  const step = [1, 2, 2.5, 5, 10].map((k) => k * pow).find((st) => m / st <= 4) ?? pow * 10
  const top = Math.ceil(m / step) * step
  const ticks: number[] = []
  for (let v = 0; v <= top + step * 0.001; v += step) ticks.push(Math.round(v * 1000) / 1000)
  return { ticks, top }
})
const ticks = computed(() => scale.value.ticks)
const axisMax = computed(() => scale.value.top)

const peakIndex = computed(() => props.points.reduce((best, p, i) => (p.value > (props.points[best]?.value ?? -1) ? i : best), 0))
const hover = ref<number | null>(null)
const showTable = ref(false)

function barHeight(v: number) {
  return Math.max(v > 0 ? 3 : 0, (v / axisMax.value) * props.height)
}
</script>

<template>
  <div>
    <!-- pt-2 — место под верхнюю подпись оси: она центрируется по границе
         полотна и без отступа наезжает на подзаголовок карточки -->
    <div v-if="!showTable" class="flex gap-3 pt-2">
      <!-- ось значений -->
      <div class="relative shrink-0" :style="{ height: `${height}px`, width: '58px' }">
        <span
          v-for="t in ticks" :key="t"
          class="tabular absolute right-0 -translate-y-1/2 whitespace-nowrap text-[10.5px] text-muted"
          :style="{ bottom: `${(t / axisMax) * height}px` }"
        >{{ fmt(t) }}</span>
      </div>

      <div class="min-w-0 flex-1">
        <!-- полотно -->
        <div class="relative" :style="{ height: `${height}px` }">
          <!-- сетка: сплошные волосяные линии на один шаг от поверхности -->
          <span
            v-for="t in ticks" :key="t" class="absolute inset-x-0 h-px bg-chart-grid"
            :style="{ bottom: `${(t / axisMax) * height}px` }"
          />
          <div class="absolute inset-0 flex items-end gap-[2px]">
            <button
              v-for="(p, i) in points" :key="p.label" type="button"
              class="group relative flex h-full flex-1 items-end justify-center focus-ring"
              @mouseenter="hover = i" @mouseleave="hover = null" @focus="hover = i" @blur="hover = null"
            >
              <!-- столбец: не шире 24px, скруглён сверху, прямой у базовой линии -->
              <span
                class="w-full max-w-[24px] rounded-t transition-colors"
                :class="p.muted ? 'bg-chart-free' : hover === i ? 'bg-chart-accent' : 'bg-chart-accent/75'"
                :style="{ height: `${barHeight(p.value)}px` }"
              />
              <!-- подпись только у пика: число на каждом столбце не читают -->
              <span
                v-if="i === peakIndex && hover === null"
                class="tabular pointer-events-none absolute -translate-y-1 whitespace-nowrap text-[10.5px] font-semibold text-muted"
                :style="{ bottom: `${barHeight(p.value)}px` }"
              >{{ p.display ?? fmt(p.value) }}</span>
            </button>
          </div>

          <!-- подсказка при наведении -->
          <div
            v-if="hover !== null && points[hover]"
            class="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-2 whitespace-nowrap rounded-lg border border-line bg-panel px-2.5 py-1.5 shadow-pop"
            :style="{ left: `${((hover + 0.5) / points.length) * 100}%`, bottom: `${barHeight(points[hover]!.value)}px` }"
          >
            <p class="text-[10.5px] uppercase tracking-[0.03em] text-muted">{{ points[hover]!.label }}</p>
            <p class="text-[13px] font-semibold text-ink">{{ points[hover]!.display ?? fmt(points[hover]!.value) }}</p>
          </div>
        </div>

        <!-- полоса оси X внутри общей высоты блока -->
        <div class="mt-2 flex gap-[2px]">
          <span
            v-for="(p, i) in points" :key="p.label"
            class="flex-1 text-center text-[10.5px] transition-colors"
            :class="hover === i ? 'font-semibold text-ink' : 'text-muted'"
          >{{ p.label }}</span>
        </div>
      </div>
    </div>

    <!-- табличный близнец: любое значение доступно без наведения -->
    <div v-else class="max-h-[248px] overflow-auto rounded-xl2 border border-line">
      <table class="data-table">
        <thead><tr><th>Период</th><th class="text-right">{{ valueLabel }}</th></tr></thead>
        <tbody>
          <tr v-for="p in points" :key="p.label">
            <td>{{ p.label }}</td>
            <td class="tabular text-right font-semibold">{{ p.display ?? fmt(p.value) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <button
      type="button" class="mt-2.5 flex items-center gap-1 text-[11.5px] font-medium text-muted hover:text-ink"
      @click="showTable = !showTable"
    >
      <Icon :name="showTable ? 'ph:chart-bar' : 'ph:table'" size="13" />
      {{ showTable ? 'Показать график' : 'Показать таблицей' }}
    </button>
  </div>
</template>
