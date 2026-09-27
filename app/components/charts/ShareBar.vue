<script setup lang="ts">
// Доли в целом: одна горизонтальная полоса + легенда со значениями.
// Сегменты разделяет 2px зазор цветом поверхности, а не обводка: обводка
// добавляет «чернил», которые не являются данными.
export interface ShareSegment {
  key: string
  label: string
  value: number
  /** CSS-цвет марки (обычно var(--c-*)) */
  color: string
}

const props = withDefaults(defineProps<{
  segments: ShareSegment[]
  /** подпись столбца значений в табличном виде */
  valueLabel?: string
  formatValue?: (v: number) => string
  thickness?: number
  /** скрыть переключатель таблицы — например когда полоса вложена в ссылку */
  hideTableToggle?: boolean
}>(), { valueLabel: 'Объектов', thickness: 12, hideTableToggle: false })

const total = computed(() => props.segments.reduce((s, x) => s + x.value, 0))
const shown = computed(() => props.segments.filter((s) => s.value > 0))
const hover = ref<string | null>(null)
const showTable = ref(false)

function pct(v: number) {
  return total.value ? (v / total.value) * 100 : 0
}
const fmt = (v: number) => (props.formatValue ? props.formatValue(v) : v.toLocaleString('ru-RU'))
</script>

<template>
  <div>
    <div v-if="!showTable">
      <div class="flex overflow-hidden rounded-full" :style="{ height: `${thickness}px`, gap: '2px' }">
        <span
          v-for="s in shown" :key="s.key"
          class="h-full cursor-default transition-opacity first:rounded-l-full last:rounded-r-full"
          :style="{ width: `${pct(s.value)}%`, background: s.color, opacity: hover && hover !== s.key ? 0.35 : 1 }"
          :title="`${s.label}: ${fmt(s.value)}`"
          @mouseenter="hover = s.key" @mouseleave="hover = null"
        />
      </div>

      <!-- легенда: идентичность никогда не только цветом — точка + подпись + значение -->
      <dl class="mt-3.5 flex flex-col">
        <div
          v-for="s in segments" :key="s.key"
          class="flex items-center gap-2 border-b border-line py-[7px] last:border-0"
          @mouseenter="hover = s.key" @mouseleave="hover = null"
        >
          <span class="h-2.5 w-2.5 shrink-0 rounded-sm" :style="{ background: s.color }" />
          <dt class="min-w-0 flex-1 truncate text-[12.5px] text-muted">{{ s.label }}</dt>
          <dd class="tabular text-[13px] font-semibold text-ink">{{ fmt(s.value) }}</dd>
          <dd class="tabular w-10 shrink-0 text-right text-[12px] text-muted">{{ Math.round(pct(s.value)) }}%</dd>
        </div>
      </dl>
    </div>

    <div v-else class="overflow-hidden rounded-xl2 border border-line">
      <table class="data-table">
        <thead><tr><th>Статус</th><th class="text-right">{{ valueLabel }}</th><th class="text-right">Доля</th></tr></thead>
        <tbody>
          <tr v-for="s in segments" :key="s.key">
            <td class="flex items-center gap-2"><span class="h-2.5 w-2.5 rounded-sm" :style="{ background: s.color }" />{{ s.label }}</td>
            <td class="tabular text-right font-semibold">{{ fmt(s.value) }}</td>
            <td class="tabular text-right text-muted">{{ Math.round(pct(s.value)) }}%</td>
          </tr>
        </tbody>
      </table>
    </div>

    <button v-if="!hideTableToggle" type="button" class="mt-2.5 flex items-center gap-1 text-[11.5px] font-medium text-muted hover:text-ink" @click="showTable = !showTable">
      <Icon :name="showTable ? 'ph:chart-bar-horizontal' : 'ph:table'" size="13" />
      {{ showTable ? 'Показать полосой' : 'Показать таблицей' }}
    </button>
  </div>
</template>
