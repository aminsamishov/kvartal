<script setup lang="ts">
import type { ZonePoint } from '~/types/models'
import { readableInk } from '~/utils/color'

export interface ZoneMark {
  id: string
  polygon: ZonePoint[]
  color: string
  label: string
  /** мелкая вторая строка в подписи — цена или площадь */
  sublabel?: string
  selected?: boolean
  /** не проходит фильтр — гасим, но оставляем кликабельной */
  dim?: boolean
  /** контур выведен автоматически, а не размечен руками */
  derived?: boolean
  /** правый верхний угол контура — процент совпадения */
  badge?: string
}

/**
 * Изображение с интерактивными контурами: фасад и план этажа.
 * Только просмотр — рисование живёт в ImageZoneEditor. Здесь важно другое:
 * масштаб, панорамирование, подсветка по статусу и мультивыбор, синхронный
 * с шахматкой.
 */
const props = withDefaults(defineProps<{
  imageUrl: string
  marks: ZoneMark[]
  /** id подсвеченного извне контура — например при наведении в списке */
  highlightId?: string | null
  height?: string
  showLabels?: boolean
  /** клик по контуру переключает выделение, а не открывает карточку */
  multi?: boolean
}>(), { height: 'min(62vh, 620px)', showLabels: true, multi: false })

const emit = defineEmits<{
  pick: [string]
  toggle: [string]
  hover: [string | null]
}>()

const MIN_ZOOM = 1
const MAX_ZOOM = 5

const wrapRef = ref<HTMLElement | null>(null)
const zoom = ref(1)
const labels = ref(props.showLabels)
const hoverId = ref<string | null>(null)
const tipPos = ref<{ x: number; y: number } | null>(null)

const hoverMark = computed(() => props.marks.find((m) => m.id === hoverId.value) ?? null)
const activeId = computed(() => props.highlightId ?? hoverId.value)

function pointsAttr(polygon: ZonePoint[]) {
  return polygon.map((p) => `${p.x},${p.y}`).join(' ')
}

/** Центр по площади: подпись должна стоять внутри контура, а не в центре bbox. */
function centroid(polygon: ZonePoint[]): ZonePoint {
  if (polygon.length < 3) return polygon[0] ?? { x: 0.5, y: 0.5 }
  let area = 0; let cx = 0; let cy = 0
  for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i]!
    const q = polygon[(i + 1) % polygon.length]!
    const cross = p.x * q.y - q.x * p.y
    area += cross
    cx += (p.x + q.x) * cross
    cy += (p.y + q.y) * cross
  }
  if (Math.abs(area) < 1e-9) {
    const xs = polygon.map((p) => p.x); const ys = polygon.map((p) => p.y)
    return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 }
  }
  return { x: cx / (3 * area), y: cy / (3 * area) }
}

function topRight(polygon: ZonePoint[]) {
  const xs = polygon.map((p) => p.x); const ys = polygon.map((p) => p.y)
  return { x: Math.max(...xs), y: Math.min(...ys) }
}

/* -------------------------------- масштаб --------------------------------- */

function setZoom(next: number, anchor?: { x: number; y: number }) {
  const el = wrapRef.value
  const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +next.toFixed(2)))
  if (!el || clamped === zoom.value) { zoom.value = clamped; return }
  // держим точку под курсором на месте — иначе после зума взгляд теряет квартиру
  const ratio = clamped / zoom.value
  const ax = anchor?.x ?? el.clientWidth / 2
  const ay = anchor?.y ?? el.clientHeight / 2
  const left = (el.scrollLeft + ax) * ratio - ax
  const top = (el.scrollTop + ay) * ratio - ay
  zoom.value = clamped
  nextTick(() => {
    el.scrollLeft = left
    el.scrollTop = top
  })
}

function onWheel(e: WheelEvent) {
  // без модификатора колесо должно скроллить страницу, иначе панель ловит жест
  if (!e.ctrlKey && !e.metaKey) return
  e.preventDefault()
  const el = wrapRef.value
  const r = el?.getBoundingClientRect()
  setZoom(zoom.value * (e.deltaY < 0 ? 1.15 : 0.87), r ? { x: e.clientX - r.left, y: e.clientY - r.top } : undefined)
}

function resetView() {
  zoom.value = 1
  const el = wrapRef.value
  if (el) { el.scrollLeft = 0; el.scrollTop = 0 }
}

/* ----------------------------- панорамирование ----------------------------- */

const panning = ref(false)
let panStart = { x: 0, y: 0, left: 0, top: 0 }
let panMoved = false

function onPanDown(e: MouseEvent) {
  if (zoom.value <= 1 || e.button !== 0) return
  const el = wrapRef.value
  if (!el) return
  panning.value = true
  panMoved = false
  panStart = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop }
  window.addEventListener('mousemove', onPanMove)
  window.addEventListener('mouseup', onPanUp)
}
function onPanMove(e: MouseEvent) {
  const el = wrapRef.value
  if (!el) return
  const dx = e.clientX - panStart.x
  const dy = e.clientY - panStart.y
  if (Math.abs(dx) > 3 || Math.abs(dy) > 3) panMoved = true
  el.scrollLeft = panStart.left - dx
  el.scrollTop = panStart.top - dy
}
function onPanUp() {
  panning.value = false
  window.removeEventListener('mousemove', onPanMove)
  window.removeEventListener('mouseup', onPanUp)
}
onBeforeUnmount(onPanUp)

/* --------------------------------- ввод ----------------------------------- */

function onZoneClick(mark: ZoneMark, e: MouseEvent) {
  // перетаскивание карты не должно открывать карточку под курсором
  if (panMoved) { panMoved = false; return }
  if (props.multi || e.metaKey || e.ctrlKey || e.shiftKey) emit('toggle', mark.id)
  else emit('pick', mark.id)
}

function onZoneEnter(mark: ZoneMark) {
  hoverId.value = mark.id
  emit('hover', mark.id)
}
function onLeave() {
  hoverId.value = null
  tipPos.value = null
  emit('hover', null)
}
function onMove(e: MouseEvent) {
  const el = wrapRef.value
  if (!el) return
  const r = el.getBoundingClientRect()
  tipPos.value = { x: e.clientX - r.left, y: e.clientY - r.top }
}

watch(() => props.showLabels, (v) => (labels.value = v))

const fillOpacity = (m: ZoneMark) => {
  if (m.dim) return 0.08
  if (m.selected) return 0.62
  if (activeId.value === m.id) return 0.5
  return 0.34
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <!-- управление просмотром -->
    <div class="flex flex-wrap items-center gap-2">
      <div class="flex items-center gap-1 rounded-lg border border-line bg-panel px-1.5 py-1">
        <button
          class="focus-ring grid h-6 w-6 place-items-center rounded text-muted hover:text-ink disabled:opacity-40"
          :disabled="zoom <= 1" title="Уменьшить" @click="setZoom(zoom - 0.5)"
        ><Icon name="ph:magnifying-glass-minus" size="14" /></button>
        <span class="tabular w-10 text-center text-[11.5px] font-semibold">{{ Math.round(zoom * 100) }}%</span>
        <button
          class="focus-ring grid h-6 w-6 place-items-center rounded text-muted hover:text-ink disabled:opacity-40"
          :disabled="zoom >= 5" title="Увеличить" @click="setZoom(zoom + 0.5)"
        ><Icon name="ph:magnifying-glass-plus" size="14" /></button>
      </div>
      <button
        class="focus-ring grid h-8 w-8 place-items-center rounded-lg border border-line bg-panel text-muted hover:text-ink disabled:opacity-40"
        :disabled="zoom === 1" title="Показать целиком" @click="resetView"
      ><Icon name="ph:arrows-in-simple" size="15" /></button>
      <button
        class="focus-ring grid h-8 w-8 place-items-center rounded-lg border border-line bg-panel hover:text-ink"
        :class="labels ? 'text-ink' : 'text-muted'" title="Подписи помещений" @click="labels = !labels"
      ><Icon :name="labels ? 'ph:eye' : 'ph:eye-slash'" size="15" /></button>
      <p class="ml-auto hidden items-center gap-1.5 text-[11.5px] text-muted sm:flex">
        <Icon name="ph:cursor-click" size="13" />
        Клик — карточка, Ctrl+клик — выделить{{ zoom > 1 ? ', тяните для панорамы' : '' }}
      </p>
      <slot name="actions" />
    </div>

    <!-- полотно -->
    <div
      ref="wrapRef"
      class="relative overflow-auto rounded-xl2 border border-line bg-soft"
      :style="{ height }"
      :class="panning ? 'cursor-grabbing' : zoom > 1 ? 'cursor-grab' : ''"
      @wheel="onWheel" @mousedown="onPanDown" @mousemove="onMove" @mouseleave="onLeave"
    >
      <div class="relative select-none" :style="{ width: `${zoom * 100}%` }">
        <img :src="imageUrl" class="pointer-events-none block w-full select-none" draggable="false" alt="">

        <svg class="absolute inset-0 h-full w-full" viewBox="0 0 1 1" preserveAspectRatio="none">
          <polygon
            v-for="m in marks" :key="m.id" :points="pointsAttr(m.polygon)"
            vector-effect="non-scaling-stroke" class="cursor-pointer"
            :style="{
              fill: m.color,
              fillOpacity: fillOpacity(m),
              stroke: m.selected ? 'var(--ink)' : m.color,
              strokeWidth: m.selected ? 3 : activeId === m.id ? 2.5 : 1.2,
              strokeDasharray: m.derived ? '4 3' : undefined,
              transition: 'fill-opacity .12s',
            }"
            @mouseenter="onZoneEnter(m)"
            @click.stop="onZoneClick(m, $event)"
          />
        </svg>

        <!-- подписи и бейджи совпадения -->
        <template v-if="labels">
          <span
            v-for="m in marks" :key="`l-${m.id}`"
            class="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded px-1 py-px text-center text-[10px] font-bold leading-tight shadow-sm"
            :style="{
              left: `${centroid(m.polygon).x * 100}%`, top: `${centroid(m.polygon).y * 100}%`,
              background: m.selected ? 'var(--ink)' : m.color,
              color: m.selected ? 'var(--panel)' : readableInk(m.color),
              opacity: m.dim ? 0.3 : 1,
            }"
          >
            {{ m.label }}
            <span v-if="m.sublabel" class="block text-[9px] font-semibold opacity-80">{{ m.sublabel }}</span>
          </span>
        </template>

        <span
          v-for="m in marks.filter((x) => x.badge && !x.dim)" :key="`b-${m.id}`"
          class="pointer-events-none absolute -translate-x-full -translate-y-1/2 rounded-full bg-panel px-1 text-[9px] font-bold text-ink shadow-sm ring-1 ring-line"
          :style="{ left: `${topRight(m.polygon).x * 100}%`, top: `${topRight(m.polygon).y * 100}%` }"
        >{{ m.badge }}</span>
      </div>

      <!-- подсказка -->
      <div
        v-if="hoverMark && tipPos"
        class="pointer-events-none absolute z-20 w-[210px] rounded-xl2 border border-line bg-panel p-2.5 shadow-pop"
        :style="{
          left: `${Math.min(tipPos.x + 14, (wrapRef?.clientWidth ?? 400) - 220)}px`,
          top: `${Math.min(tipPos.y + 14, Math.max(8, (wrapRef?.clientHeight ?? 300) - 130))}px`,
        }"
      >
        <slot name="tip" :mark="hoverMark">
          <p class="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink">
            <span class="h-2 w-2 shrink-0 rounded-full" :style="{ background: hoverMark.color }" />
            {{ hoverMark.label }}
          </p>
          <p v-if="hoverMark.sublabel" class="mt-0.5 text-[11.5px] text-muted">{{ hoverMark.sublabel }}</p>
        </slot>
      </div>

      <EmptyState
        v-if="!marks.length" compact icon="ph:polygon" title="Помещения не размечены"
        class="pointer-events-none absolute left-1/2 top-1/2 w-[min(400px,80%)] -translate-x-1/2 -translate-y-1/2 bg-panel/85 backdrop-blur-sm"
      />
    </div>
  </div>
</template>
