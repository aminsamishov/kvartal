<script setup lang="ts">
import type { ImageZone, ZonePoint } from '~/types/models'
import { uid } from '~/repositories/api'
import { clamp01, dist, movePolygon, zoneArea, zoneCentroid, zonePointsAttr, zonePolygon } from '~/utils/zones'
import { readableInk } from '~/utils/color'

export interface ZoneOption {
  value: string
  label: string
  color: string
  hint?: string
}

const props = withDefaults(defineProps<{
  imageUrl: string
  zones: ImageZone[]
  options: ZoneOption[]
  emptyOptionsHint?: string
  /** режим просмотра: без рисования, только подсветка и клик по области */
  readonly?: boolean
  /** подпись сущности в текстах интерфейса */
  entityLabel?: string
}>(), { readonly: false, entityLabel: 'помещение' })

const emit = defineEmits<{
  'update:zones': [ImageZone[]]
  pick: [string]
}>()

const ui = useUiStore()

type Tool = 'poly' | 'rect' | 'edit'
const tool = ref<Tool>('poly')
const zoom = ref(1)
const showLabels = ref(true)
// базовая прозрачность заливки: сквозь неё должен читаться чертёж под областью
const FILL_OPACITY = 0.32

const wrapRef = ref<HTMLElement | null>(null)
const imgRef = ref<HTMLImageElement | null>(null)

const selectedId = ref<string | null>(null)
const hoverId = ref<string | null>(null)
const hoverPos = ref<{ x: number; y: number } | null>(null)

const draftRect = ref<{ a: ZonePoint; b: ZonePoint } | null>(null)
const draftPoly = ref<ZonePoint[]>([])
const polyCursor = ref<ZonePoint | null>(null)

const history = ref<ImageZone[][]>([])

/* --------------------------- привязка и состояние -------------------------- */

const optionByValue = computed(() => new Map(props.options.map((o) => [o.value, o])))
const assigned = computed(() => new Set(props.zones.map((z) => z.refId)))
const unassigned = computed(() => props.options.filter((o) => !assigned.value.has(o.value)))

// к чему привяжется следующая нарисованная область: либо выбрано вручную,
// либо первая неразмеченная позиция — тогда разметка идёт «конвейером»
const manualTarget = ref<string | null>(null)
const target = computed<ZoneOption | null>(() => {
  if (manualTarget.value) return optionByValue.value.get(manualTarget.value) ?? null
  return unassigned.value[0] ?? null
})

const coverage = computed(() => ({
  done: props.options.filter((o) => assigned.value.has(o.value)).length,
  total: props.options.length,
}))

const selectedZone = computed(() => props.zones.find((z) => z.id === selectedId.value) ?? null)
const hoverZone = computed(() => props.zones.find((z) => z.id === hoverId.value) ?? null)

function zoneColor(z: ImageZone) {
  return optionByValue.value.get(z.refId)?.color ?? z.color
}
function zoneLabel(z: ImageZone) {
  return optionByValue.value.get(z.refId)?.label ?? z.label
}
function zoneHint(z: ImageZone) {
  return optionByValue.value.get(z.refId)?.hint
}
/** область, нарисованная для позиции, которой больше нет в списке */
function isOrphan(z: ImageZone) {
  return !optionByValue.value.has(z.refId)
}

/* -------------------------------- координаты ------------------------------- */

function relPos(e: MouseEvent): ZonePoint {
  const el = imgRef.value
  if (!el) return { x: 0, y: 0 }
  const rect = el.getBoundingClientRect()
  return {
    x: clamp01((e.clientX - rect.left) / rect.width),
    y: clamp01((e.clientY - rect.top) / rect.height),
  }
}

/* --------------------------------- мутации --------------------------------- */

function commit(next: ImageZone[]) {
  history.value.push(props.zones.map((z) => ({ ...z, points: z.points.map((p) => ({ ...p })) })))
  if (history.value.length > 40) history.value.shift()
  emit('update:zones', next)
}

function undo() {
  const prev = history.value.pop()
  if (!prev) return
  emit('update:zones', prev)
  selectedId.value = null
}

function addZone(shape: 'rect' | 'poly', points: ZonePoint[]) {
  const opt = target.value
  if (!opt) {
    ui.toast(props.emptyOptionsHint ?? 'Все позиции уже размечены — выберите, что переразметить', 'info')
    return
  }
  const existing = props.zones.find((z) => z.refId === opt.value)
  const zone: ImageZone = { id: uid('zone'), shape, points, refId: opt.value, label: opt.label, color: opt.color }
  // одна позиция — одна область: повторная разметка заменяет прежнюю
  commit([...props.zones.filter((z) => z.id !== existing?.id), zone])
  selectedId.value = zone.id
  manualTarget.value = null
  if (existing) ui.toast(`Область для «${opt.label}» перерисована`, 'info')
}

function reassign(zoneId: string, refId: string) {
  const opt = optionByValue.value.get(refId)
  if (!opt) return
  commit(props.zones
    .filter((z) => z.refId !== refId || z.id === zoneId)
    .map((z) => (z.id === zoneId ? { ...z, refId: opt.value, label: opt.label, color: opt.color } : z)))
}

function removeZone(zoneId: string) {
  commit(props.zones.filter((z) => z.id !== zoneId))
  selectedId.value = null
}

function clearAll() {
  if (!props.zones.length) return
  commit([])
  selectedId.value = null
  ui.toast('Разметка очищена', 'info')
}

function setPoints(zoneId: string, points: ZonePoint[]) {
  emit('update:zones', props.zones.map((z) => (z.id === zoneId ? { ...z, points } : z)))
}

/* ------------------------------- рисование ---------------------------------- */

function onWrapMouseDown(e: MouseEvent) {
  if (props.readonly) return
  if (e.button !== 0) return
  if (tool.value === 'edit') {
    selectedId.value = null
    return
  }
  if (!props.options.length) {
    ui.toast(props.emptyOptionsHint ?? 'Список привязки пуст', 'warn')
    return
  }
  const p = relPos(e)
  if (tool.value === 'rect') {
    draftRect.value = { a: p, b: p }
    selectedId.value = null
    window.addEventListener('mousemove', onRectMove)
    window.addEventListener('mouseup', onRectUp)
    return
  }
  // полигон по точкам: замыкаем, если клик рядом с первой точкой
  const first = draftPoly.value[0]
  if (first && draftPoly.value.length >= 3 && dist(p, first) < 0.02) {
    closePoly()
    return
  }
  draftPoly.value = [...draftPoly.value, p]
  polyCursor.value = p
}

function onRectMove(e: MouseEvent) {
  if (draftRect.value) draftRect.value.b = relPos(e)
}
function onRectUp() {
  window.removeEventListener('mousemove', onRectMove)
  window.removeEventListener('mouseup', onRectUp)
  const d = draftRect.value
  draftRect.value = null
  if (!d) return
  if (Math.abs(d.a.x - d.b.x) < 0.01 || Math.abs(d.a.y - d.b.y) < 0.01) return
  addZone('rect', [d.a, d.b])
}

function closePoly() {
  if (draftPoly.value.length < 3) {
    ui.toast('Нужно минимум 3 точки', 'warn')
    return
  }
  addZone('poly', draftPoly.value)
  draftPoly.value = []
  polyCursor.value = null
}
function cancelPoly() {
  draftPoly.value = []
  polyCursor.value = null
}
function undoPolyPoint() {
  draftPoly.value = draftPoly.value.slice(0, -1)
}

function onWrapMouseMove(e: MouseEvent) {
  const el = wrapRef.value
  if (el) {
    const r = el.getBoundingClientRect()
    hoverPos.value = { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  if (tool.value === 'poly' && draftPoly.value.length) polyCursor.value = relPos(e)
}

/* -------------------------- правка: перенос и точки ------------------------- */

interface DragState {
  kind: 'move' | 'vertex' | 'rect-corner'
  zoneId: string
  index: number
  start: ZonePoint
  orig: ZonePoint[]
  fixed?: ZonePoint
}
const drag = ref<DragState | null>(null)

function onZoneMouseDown(z: ImageZone, e: MouseEvent) {
  if (props.readonly) {
    emit('pick', z.refId)
    return
  }
  if (tool.value !== 'edit') return
  e.stopPropagation()
  selectedId.value = z.id
  drag.value = { kind: 'move', zoneId: z.id, index: -1, start: relPos(e), orig: z.points.map((p) => ({ ...p })) }
  attachDrag()
}

function onVertexMouseDown(z: ImageZone, index: number, e: MouseEvent) {
  e.stopPropagation()
  selectedId.value = z.id
  if (z.shape === 'rect') {
    // тянем угол — противоположный остаётся на месте, фигура остаётся прямоугольной
    const corners = zonePolygon(z)
    const fixed = corners[(index + 2) % 4]!
    drag.value = { kind: 'rect-corner', zoneId: z.id, index, start: relPos(e), orig: z.points.map((p) => ({ ...p })), fixed }
  } else {
    drag.value = { kind: 'vertex', zoneId: z.id, index, start: relPos(e), orig: z.points.map((p) => ({ ...p })) }
  }
  attachDrag()
}

function attachDrag() {
  window.addEventListener('mousemove', onDragMove)
  window.addEventListener('mouseup', onDragUp)
}
function onDragMove(e: MouseEvent) {
  const d = drag.value
  if (!d) return
  const p = relPos(e)
  if (d.kind === 'move') {
    setPoints(d.zoneId, movePolygon(d.orig, p.x - d.start.x, p.y - d.start.y))
  } else if (d.kind === 'vertex') {
    setPoints(d.zoneId, d.orig.map((pt, i) => (i === d.index ? p : pt)))
  } else if (d.fixed) {
    setPoints(d.zoneId, [d.fixed, p])
  }
}
function onDragUp() {
  window.removeEventListener('mousemove', onDragMove)
  window.removeEventListener('mouseup', onDragUp)
  drag.value = null
}

/** добавить точку в середину ребра — контур можно уточнять после рисования */
function insertVertex(z: ImageZone, index: number) {
  if (z.shape !== 'poly') return
  const a = z.points[index]!
  const b = z.points[(index + 1) % z.points.length]!
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  commit(props.zones.map((x) => (x.id === z.id ? { ...x, points: [...x.points.slice(0, index + 1), mid, ...x.points.slice(index + 1)] } : x)))
}

function deleteVertex(z: ImageZone, index: number) {
  if (z.shape !== 'poly' || z.points.length <= 3) return
  commit(props.zones.map((x) => (x.id === z.id ? { ...x, points: x.points.filter((_, i) => i !== index) } : x)))
}

function midPoints(z: ImageZone) {
  if (z.shape !== 'poly') return []
  return z.points.map((p, i) => {
    const q = z.points[(i + 1) % z.points.length]!
    return { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2, index: i }
  })
}

/* -------------------------------- клавиатура ------------------------------- */

function onKey(e: KeyboardEvent) {
  if (props.readonly) return
  const t = e.target as HTMLElement | null
  if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return
  if (e.key === 'Escape') {
    if (draftPoly.value.length) cancelPoly()
    else selectedId.value = null
    return
  }
  if (e.key === 'Enter' && draftPoly.value.length) { closePoly(); return }
  if (e.key === 'Backspace' && draftPoly.value.length) { e.preventDefault(); undoPolyPoint(); return }
  if ((e.key === 'Delete' || e.key === 'Backspace') && selectedZone.value) { e.preventDefault(); removeZone(selectedZone.value.id); return }
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return }
  if (e.key === '1') tool.value = 'poly'
  if (e.key === '2') tool.value = 'rect'
  if (e.key === '3') tool.value = 'edit'
}

onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('mousemove', onRectMove)
  window.removeEventListener('mouseup', onRectUp)
  window.removeEventListener('mousemove', onDragMove)
  window.removeEventListener('mouseup', onDragUp)
})

watch(tool, () => cancelPoly())

/* --------------------------------- вывод ----------------------------------- */

const draftRectAttr = computed(() => {
  const d = draftRect.value
  if (!d) return ''
  const x0 = Math.min(d.a.x, d.b.x)
  const x1 = Math.max(d.a.x, d.b.x)
  const y0 = Math.min(d.a.y, d.b.y)
  const y1 = Math.max(d.a.y, d.b.y)
  return `${x0},${y0} ${x1},${y0} ${x1},${y1} ${x0},${y1}`
})

const draftPolyAttr = computed(() => {
  const pts = [...draftPoly.value]
  if (polyCursor.value && pts.length) pts.push(polyCursor.value)
  return pts.map((p) => `${p.x},${p.y}`).join(' ')
})

const cursorClass = computed(() => {
  if (props.readonly) return 'cursor-pointer'
  if (tool.value === 'edit') return 'cursor-default'
  return 'cursor-crosshair'
})

function focusZone(refId: string) {
  const z = props.zones.find((x) => x.refId === refId)
  if (z) selectedId.value = z.id
  else manualTarget.value = refId
}

/** Прямоугольник можно доработать как контур — например обвести эркер. */
function toPolygon(z: ImageZone) {
  if (z.shape !== 'poly') commit(props.zones.map((x) => (x.id === z.id ? { ...x, shape: 'poly' as const, points: zonePolygon(x) } : x)))
}

/** Доля изображения, занятая областью — подсказка «не забыли ли масштаб». */
function zoneSharePercent(z: ImageZone) {
  return Math.round(zoneArea(z) * 1000) / 10
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- панель инструментов -->
    <div v-if="!readonly" class="flex flex-wrap items-center gap-2 rounded-xl2 border border-line bg-soft p-2">
      <div class="flex overflow-hidden rounded-lg border border-line bg-panel">
        <button
          v-for="t in ([{ v: 'poly', i: 'ph:polygon', l: 'По точкам' }, { v: 'rect', i: 'ph:rectangle', l: 'Прямоугольник' }, { v: 'edit', i: 'ph:cursor', l: 'Правка' }] as const)"
          :key="t.v" type="button"
          class="focus-ring flex items-center gap-1.5 px-2.5 py-1.5 text-[12.5px] font-semibold transition-colors"
          :class="tool === t.v ? 'bg-fill-plum text-white' : 'text-muted hover:bg-soft hover:text-ink'"
          :title="`${t.l} (${t.v === 'poly' ? '1' : t.v === 'rect' ? '2' : '3'})`"
          @click="tool = t.v"
        >
          <Icon :name="t.i" size="14" /> {{ t.l }}
        </button>
      </div>

      <div class="h-6 w-px bg-line" />

      <label class="flex items-center gap-1.5 text-[12px] font-medium text-muted">
        Привязать к
        <select
          class="focus-ring max-w-[190px] rounded-lg border border-line bg-panel px-2 py-1.5 text-[12.5px] font-semibold text-ink"
          :value="target?.value ?? ''" @change="manualTarget = ($event.target as HTMLSelectElement).value || null"
        >
          <option v-if="!options.length" value="">— список пуст —</option>
          <option v-else-if="!target" value="">— всё размечено, выберите —</option>
          <option v-for="o in options" :key="o.value" :value="o.value">
            {{ o.label }}{{ assigned.has(o.value) ? ' · размечено' : '' }}
          </option>
        </select>
      </label>

      <span v-if="target" class="flex items-center gap-1.5 rounded-full px-2 py-1 text-[11.5px] font-bold" :style="{ background: target.color, color: readableInk(target.color) }">
        <Icon name="ph:crosshair" size="12" /> {{ target.label }}
      </span>

      <div class="ml-auto flex items-center gap-2">
        <div class="flex items-center gap-1 rounded-lg border border-line bg-panel px-1.5 py-1">
          <button class="focus-ring grid h-6 w-6 place-items-center rounded text-muted hover:text-ink disabled:opacity-40" :disabled="zoom <= 1" title="Уменьшить" @click="zoom = Math.max(1, +(zoom - 0.5).toFixed(1))"><Icon name="ph:magnifying-glass-minus" size="14" /></button>
          <span class="tabular w-9 text-center text-[11.5px] font-semibold">{{ Math.round(zoom * 100) }}%</span>
          <button class="focus-ring grid h-6 w-6 place-items-center rounded text-muted hover:text-ink disabled:opacity-40" :disabled="zoom >= 4" title="Увеличить" @click="zoom = Math.min(4, +(zoom + 0.5).toFixed(1))"><Icon name="ph:magnifying-glass-plus" size="14" /></button>
        </div>
        <button
          class="focus-ring grid h-8 w-8 place-items-center rounded-lg border border-line bg-panel text-muted hover:text-ink"
          :class="showLabels ? 'text-ink' : ''" title="Подписи областей" @click="showLabels = !showLabels"
        >
          <Icon :name="showLabels ? 'ph:eye' : 'ph:eye-slash'" size="15" />
        </button>
        <button class="focus-ring grid h-8 w-8 place-items-center rounded-lg border border-line bg-panel text-muted hover:text-ink disabled:opacity-40" :disabled="!history.length" title="Отменить (Ctrl+Z)" @click="undo"><Icon name="ph:arrow-counter-clockwise" size="15" /></button>
        <button class="focus-ring grid h-8 w-8 place-items-center rounded-lg border border-line bg-panel text-muted hover:text-bad disabled:opacity-40" :disabled="!zones.length" title="Очистить всю разметку" @click="clearAll"><Icon name="ph:trash" size="15" /></button>
      </div>
    </div>

    <!-- подсказка по текущему инструменту -->
    <p v-if="!readonly" class="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted">
      <template v-if="tool === 'poly'">
        <Icon name="ph:cursor-click" size="14" />
        <span>Кликайте по углам {{ entityLabel === 'этаж' ? 'этажа' : 'контура' }} — точка за точкой. Замкнуть: клик по первой точке или <kbd>Enter</kbd>. Отменить точку: <kbd>Backspace</kbd>.</span>
        <b v-if="draftPoly.length" class="text-ink">Точек: {{ draftPoly.length }}</b>
        <button v-if="draftPoly.length >= 3" class="font-semibold text-plum hover:underline" @click="closePoly">Замкнуть контур</button>
        <button v-if="draftPoly.length" class="font-semibold text-muted hover:text-bad" @click="cancelPoly">Сбросить</button>
      </template>
      <template v-else-if="tool === 'rect'">
        <Icon name="ph:selection" size="14" />
        <span>Протяните рамку с зажатой левой кнопкой — быстрый способ для этажей и прямых контуров.</span>
      </template>
      <template v-else>
        <Icon name="ph:hand-grabbing" size="14" />
        <span>Тяните область, чтобы переместить; тяните белые точки, чтобы менять контур; <b class="text-ink">+</b> на ребре добавляет точку, правый клик по точке — убирает.</span>
      </template>
    </p>

    <!-- изображение с разметкой -->
    <div
      ref="wrapRef" class="relative max-h-[70vh] overflow-auto rounded-xl2 border border-line bg-soft"
      @mousemove="onWrapMouseMove" @mouseleave="hoverId = null; hoverPos = null"
    >
      <div class="relative select-none" :class="cursorClass" :style="{ width: `${zoom * 100}%` }" @mousedown="onWrapMouseDown">
        <img ref="imgRef" :src="imageUrl" class="pointer-events-none block w-full select-none" draggable="false" alt="Разметка областей">

        <svg class="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1 1" preserveAspectRatio="none">
          <polygon
            v-for="z in zones" :key="z.id" :points="zonePointsAttr(z)"
            vector-effect="non-scaling-stroke"
            :class="[(readonly || tool === 'edit') ? 'pointer-events-auto' : 'pointer-events-none', readonly ? 'cursor-pointer' : tool === 'edit' ? 'cursor-move' : '']"
            :style="{
              fill: zoneColor(z),
              fillOpacity: hoverId === z.id ? FILL_OPACITY + 0.22 : selectedId === z.id ? FILL_OPACITY + 0.12 : FILL_OPACITY,
              stroke: isOrphan(z) ? 'var(--bad)' : zoneColor(z),
              strokeWidth: selectedId === z.id ? 3 : hoverId === z.id ? 2.5 : 1.5,
              strokeDasharray: isOrphan(z) ? '5 4' : undefined,
              transition: 'fill-opacity .12s',
            }"
            @mouseenter="hoverId = z.id" @mouseleave="hoverId === z.id && (hoverId = null)"
            @mousedown="onZoneMouseDown(z, $event)"
          />
          <polygon v-if="draftRect" :points="draftRectAttr" vector-effect="non-scaling-stroke" fill="var(--plum)" fill-opacity=".25" stroke="var(--plum)" stroke-width="2" stroke-dasharray="6 4" />
          <polyline v-if="draftPoly.length" :points="draftPolyAttr" vector-effect="non-scaling-stroke" fill="var(--plum)" fill-opacity=".18" stroke="var(--plum)" stroke-width="2" stroke-dasharray="6 4" />
        </svg>

        <!-- подписи областей -->
        <template v-if="showLabels">
          <span
            v-for="z in zones" :key="`l-${z.id}`"
            class="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-bold shadow-sm"
            :style="{
              left: `${zoneCentroid(z).x * 100}%`, top: `${zoneCentroid(z).y * 100}%`,
              background: isOrphan(z) ? 'var(--fill-bad)' : zoneColor(z),
              color: isOrphan(z) ? '#fff' : readableInk(zoneColor(z)),
            }"
          >{{ zoneLabel(z) }}</span>
        </template>

        <!-- точки строящегося контура -->
        <span
          v-for="(p, i) in draftPoly" :key="`d-${i}`"
          class="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-plum shadow"
          :style="{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }"
        />

        <!-- ручки выбранной области -->
        <template v-if="!readonly && tool === 'edit' && selectedZone">
          <span
            v-for="(p, i) in (selectedZone.shape === 'rect' ? zonePolygon(selectedZone) : selectedZone.points)" :key="`h-${i}`"
            class="absolute z-10 h-3 w-3 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize rounded-full border-2 border-plum bg-panel shadow"
            :style="{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }"
            @mousedown.stop="onVertexMouseDown(selectedZone!, i, $event)"
            @contextmenu.prevent="deleteVertex(selectedZone!, i)"
          />
          <button
            v-for="m in midPoints(selectedZone)" :key="`m-${m.index}`" type="button"
            class="absolute z-10 grid h-4 w-4 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-plum bg-panel/90 text-[10px] font-bold leading-none text-plum hover:bg-plum hover:text-white"
            :style="{ left: `${m.x * 100}%`, top: `${m.y * 100}%` }"
            title="Добавить точку"
            @mousedown.stop @click.stop="insertVertex(selectedZone!, m.index)"
          >+</button>
        </template>

        <EmptyState
          v-if="!zones.length && !draftPoly.length && !draftRect" compact icon="ph:polygon"
          :title="readonly ? 'Области не размечены' : 'Начните разметку'"
          :text="readonly ? undefined : 'Обведите контуры по точкам — каждая область привяжется к выбранной позиции'"
          class="pointer-events-none absolute left-1/2 top-1/2 w-[min(420px,80%)] -translate-x-1/2 -translate-y-1/2 bg-panel/85 backdrop-blur-sm"
        />
      </div>

      <!-- всплывающая подсказка при наведении -->
      <div
        v-if="hoverZone && hoverPos"
        class="pointer-events-none absolute z-20 max-w-[220px] rounded-lg border border-line bg-panel px-2.5 py-1.5 text-[12px] shadow-pop"
        :style="{ left: `${hoverPos.x + 14}px`, top: `${hoverPos.y + 14}px` }"
      >
        <p class="flex items-center gap-1.5 font-semibold text-ink">
          <span class="h-2 w-2 shrink-0 rounded-full" :style="{ background: zoneColor(hoverZone) }" />
          {{ zoneLabel(hoverZone) }}
        </p>
        <p v-if="zoneHint(hoverZone)" class="mt-0.5 text-[11.5px] text-muted">{{ zoneHint(hoverZone) }}</p>
        <p v-if="isOrphan(hoverZone)" class="mt-0.5 text-[11.5px] font-medium text-bad">Позиция удалена — область осиротела</p>
      </div>
    </div>

    <!-- выбранная область -->
    <div v-if="!readonly && selectedZone" class="flex flex-wrap items-center gap-2 rounded-xl2 border border-line bg-panel p-2.5 shadow-card">
      <span class="h-3.5 w-3.5 shrink-0 rounded-full" :style="{ background: zoneColor(selectedZone) }" />
      <span class="text-[12px] font-medium text-muted">
        {{ selectedZone.shape === 'poly' ? `Контур, ${selectedZone.points.length} точек` : 'Прямоугольник' }} · {{ zoneSharePercent(selectedZone) }}% кадра
      </span>
      <button
        v-if="selectedZone.shape === 'rect'" type="button" class="text-[12px] font-semibold text-plum hover:underline"
        title="Превратить в контур, чтобы добавлять точки" @click="toPolygon(selectedZone!)"
      >В контур</button>
      <select
        class="focus-ring min-w-[160px] flex-1 rounded-lg border border-line bg-panel px-2 py-1.5 text-[12.5px] font-medium"
        :value="selectedZone.refId" @change="reassign(selectedZone!.id, ($event.target as HTMLSelectElement).value)"
      >
        <option v-if="isOrphan(selectedZone)" :value="selectedZone.refId">— позиция удалена —</option>
        <option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
      <AppButton size="sm" variant="danger" icon="ph:trash" @click="removeZone(selectedZone!.id)">Удалить область</AppButton>
    </div>

    <!-- прогресс и список позиций -->
    <div v-if="options.length" class="flex flex-col gap-2">
      <template v-if="!readonly">
        <div class="flex items-center justify-between text-[12px]">
          <span class="text-muted">Размечено</span>
          <span class="tabular font-semibold text-ink">{{ coverage.done }} из {{ coverage.total }}</span>
        </div>
        <ProgressBar :percent="coverage.total ? Math.round((coverage.done / coverage.total) * 100) : 0" tone="ok" :show-label="false" />
      </template>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="o in options" :key="o.value" type="button"
          class="focus-ring flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors"
          :class="assigned.has(o.value) ? 'border-line bg-panel text-ink hover:bg-soft' : 'border-dashed border-line text-muted hover:border-plum hover:text-plum'"
          :title="readonly ? 'Подсветить на изображении' : assigned.has(o.value) ? 'Показать область' : 'Разметить следующей'"
          @click="focusZone(o.value)"
          @mouseenter="hoverId = zones.find((z) => z.refId === o.value)?.id ?? null"
          @mouseleave="hoverId = null"
        >
          <span class="h-2 w-2 rounded-full" :style="{ background: o.color }" />
          {{ o.label }}
          <Icon v-if="assigned.has(o.value)" name="ph:check-bold" size="10" class="text-ok" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
kbd {
  font-family: var(--f-ui);
  font-size: 10.5px;
  font-weight: 700;
  padding: 1px 5px;
  border: 1px solid var(--line);
  border-bottom-width: 2px;
  border-radius: 5px;
  background: var(--panel);
  color: var(--ink);
}
</style>
