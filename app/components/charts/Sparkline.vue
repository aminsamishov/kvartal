<script setup lang="ts">
// Спарклайн для метрики: 12 точек, один ряд — легенда не нужна, подпись метрики
// сама говорит, что нарисовано. Последняя точка акцентная: смысл в том, «куда
// пришли», а не в отдельных значениях, поэтому подписей на точках нет.
//
// Ширину измеряем, а не растягиваем через preserveAspectRatio="none": при
// неравномерном масштабе круглый маркер превратился бы в эллипс.
const props = withDefaults(defineProps<{
  values: number[]
  height?: number
  tone?: 'accent' | 'ok' | 'bad' | 'muted'
}>(), { height: 34, tone: 'accent' })

const wrapRef = ref<HTMLElement | null>(null)
const { width } = useElementSize(wrapRef)
const w = computed(() => Math.max(width.value, 40))

const stroke = computed(() => ({
  accent: 'var(--c-accent)', ok: 'var(--ok)', bad: 'var(--bad)', muted: 'var(--muted)',
}[props.tone]))

const pts = computed(() => {
  const vs = props.values.length ? props.values : [0, 0]
  const min = Math.min(...vs)
  const max = Math.max(...vs)
  const span = max - min || 1
  const padY = 5
  const padX = 4
  const innerW = w.value - padX * 2
  return vs.map((v, i) => ({
    x: padX + (vs.length === 1 ? innerW / 2 : (i / (vs.length - 1)) * innerW),
    y: props.height - padY - ((v - min) / span) * (props.height - padY * 2),
  }))
})

const line = computed(() => pts.value.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '))
const areaPath = computed(() => {
  const p = pts.value
  if (p.length < 2) return ''
  return `M${p[0]!.x.toFixed(1)},${p[0]!.y.toFixed(1)}`
    + p.slice(1).map((q) => `L${q.x.toFixed(1)},${q.y.toFixed(1)}`).join('')
    + `L${p[p.length - 1]!.x.toFixed(1)},${props.height}L${p[0]!.x.toFixed(1)},${props.height}Z`
})
const last = computed(() => pts.value[pts.value.length - 1])
</script>

<template>
  <div ref="wrapRef" class="w-full">
    <svg :width="w" :height="height" :viewBox="`0 0 ${w} ${height}`" class="block" aria-hidden="true">
      <!-- заливка-подмалёвок ~10%, не насыщенный блок -->
      <path v-if="areaPath" :d="areaPath" :fill="stroke" fill-opacity="0.1" />
      <polyline :points="line" fill="none" :stroke="stroke" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
      <!-- 2px кольцо цветом поверхности, чтобы маркер читался на линии -->
      <circle v-if="last" :cx="last.x" :cy="last.y" r="3.5" :fill="stroke" stroke="var(--panel)" stroke-width="2" />
    </svg>
  </div>
</template>
