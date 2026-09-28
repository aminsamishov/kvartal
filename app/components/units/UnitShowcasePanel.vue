<script setup lang="ts">
import type { Building, Unit, ZonePoint } from '~/types/models'
import type { ZoneMark } from '~/components/units/UnitZoneCanvas.vue'
import { UNIT_BOARD_COLOR, UNIT_KIND_META, UNIT_STATUS_META } from '~/utils/meta'
import { area as fmtArea, money, moneyCompact, pluralRu } from '~/utils/format'
import { explicationTotals, roomLabel } from '~/utils/explication'
import { fmtDateTime } from '~/utils/format'

/**
 * Витрина этажа и квартиры — панель, которую менеджер показывает клиенту.
 *
 * Клик по блоку на фасаде открывает этаж: план, список планировок и цены.
 * Клик по планировке разворачивает её в карточку квартиры — не уходя с
 * рендера дома, который остаётся на экране справа. Это тот самый разговор
 * «вот ваш этаж — вот ваша квартира», ради которого фасад и нужен.
 */
const props = defineProps<{
  building: Building
  units: Unit[]
  floor: number
  /** 0 — весь этаж, иначе только этот подъезд */
  section: number
  unitId: string | null
  scopeKey: string
  projectName?: string
}>()

const emit = defineEmits<{
  close: []
  'update:floor': [number]
  'update:unit': [string | null]
  'open-plan': [number]
  open: [string]
  reserve: [string]
}>()

const board = useBoardStore()
const unitsStore = useUnitsStore()

const floors = computed(() => [...new Set(props.units.filter((u) => u.floor >= 1).map((u) => u.floor))].sort((a, b) => a - b))
const maxFloor = computed(() => floors.value[floors.value.length - 1] ?? props.building.floors)

const floorUnits = computed(() => props.units
  .filter((u) => u.floor === props.floor && (!props.section || u.section === props.section))
  .filter((u) => u.kind === 'apartment' || u.kind === 'commercial')
  .sort((a, b) => a.section - b.section || a.number.localeCompare(b.number, undefined, { numeric: true })))

const freeCount = computed(() => floorUnits.value.filter((u) => u.status === 'free').length)
const unit = computed(() => (props.unitId ? props.units.find((u) => u.id === props.unitId) : undefined))
const view = computed(() => (unit.value ? 'unit' : 'floor'))

/* --------------------------------- план этажа ------------------------------ */

const plan = computed(() => props.building.floorPlans.find((f) => f.floor === props.floor))
const hoverId = ref<string | null>(null)

function polygonOf(zone: { shape: 'rect' | 'poly'; points: ZonePoint[] }): ZonePoint[] {
  if (zone.shape === 'poly') return zone.points
  const [a, b] = zone.points
  if (!a || !b) return []
  const x0 = Math.min(a.x, b.x); const x1 = Math.max(a.x, b.x)
  const y0 = Math.min(a.y, b.y); const y1 = Math.max(a.y, b.y)
  return [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }]
}

const planMarks = computed<ZoneMark[]>(() => (plan.value?.zones ?? []).flatMap((z) => {
  const u = props.units.find((x) => x.id === z.refId)
  const polygon = polygonOf(z)
  if (!u || polygon.length < 3) return []
  // чужой подъезд гасим: клиент смотрит свой
  const outside = Boolean(props.section) && u.section !== props.section
  return [{
    id: u.id,
    polygon,
    color: UNIT_BOARD_COLOR[u.status],
    label: `№ ${u.number}`,
    sublabel: u.status === 'free' ? moneyCompact(u.price) : UNIT_STATUS_META[u.status].label,
    selected: u.id === props.unitId,
    dim: outside,
  }]
}))

/* ------------------------------- карточки квартир -------------------------- */

function presetOf(u: Unit) {
  return u.layoutPresetId ? props.building.unitTypePresets.find((p) => p.id === u.layoutPresetId) : undefined
}
function thumbOf(u: Unit) {
  return u.imageUrl || presetOf(u)?.imageUrl || null
}
function perM2(u: Unit) {
  return Math.round(u.price / (u.area || 1))
}

/* ------------------------------ карточка квартиры -------------------------- */

const tab = ref<'specs' | 'rooms' | 'history'>('specs')
watch(() => props.unitId, () => { tab.value = 'specs' })

const explication = computed(() => (unit.value ? unitsStore.explicationFor(unit.value.id) : { rooms: [], own: false }))
const explicationTotal = computed(() => explicationTotals(explication.value.rooms))
const history = computed(() => (unit.value ? unitsStore.historyFor(unit.value.id).slice(0, 8) : []))

const specs = computed(() => {
  const u = unit.value
  if (!u) return []
  const b = props.building
  return [
    ['Номер помещения', u.number],
    ['Тип', UNIT_KIND_META[u.kind].label],
    ['Подъезд', u.section ? `Секция ${u.section}` : '—'],
    ['Этаж', `${u.floor} из ${b.floors}`],
    ['Комнат', u.rooms ? String(u.rooms) : '—'],
    ['Площадь', fmtArea(u.area)],
    ['Цена за м²', money(perM2(u))],
    ['Отделка', { none: 'Без отделки', rough: 'Черновая', fine: 'Чистовая', furnished: 'Меблировано' }[u.finishing]],
    ['Планировка', presetOf(u)?.name ?? 'не привязана'],
    ['Адрес', b.address || '—'],
  ] as [string, string][]
})

const isSelected = computed(() => (unit.value ? board.scope(props.scopeKey).selected.includes(unit.value.id) : false))

function stepFloor(delta: number) {
  const next = props.floor + delta
  if (next < 1 || next > maxFloor.value) return
  emit('update:unit', null)
  emit('update:floor', next)
}

function onKey(e: KeyboardEvent) {
  const el = e.target as HTMLElement | null
  if (el && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return
  if (e.key === 'Escape') {
    if (unit.value) emit('update:unit', null)
    else emit('close')
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <Transition
      appear
      enter-active-class="transition-transform duration-200 ease-out" leave-active-class="transition-transform duration-150 ease-in"
      enter-from-class="-translate-x-full" leave-to-class="-translate-x-full"
    >
      <aside
        class="fixed bottom-0 left-0 top-16 z-[60] flex w-[min(460px,94vw)] flex-col border-r border-line bg-panel shadow-pop"
      >
        <!-- шапка: где мы находимся -->
        <header class="flex items-start gap-3 border-b border-line px-4 py-3">
          <button
            v-if="view === 'unit'"
            class="focus-ring mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted hover:bg-soft hover:text-ink"
            title="К этажу" @click="emit('update:unit', null)"
          ><Icon name="ph:arrow-left" size="16" /></button>

          <div class="min-w-0 flex-1">
            <template v-if="view === 'floor'">
              <p class="truncate text-[15px] font-semibold text-ink">{{ projectName ?? 'Проект' }}</p>
              <p class="truncate text-[12px] text-muted">
                {{ building.name }}<template v-if="section"> · {{ section }} подъезд</template>
              </p>
            </template>
            <template v-else-if="unit">
              <p class="truncate text-[15px] font-semibold text-ink">Квартира № {{ unit.number }}</p>
              <p class="truncate text-[12px] text-muted">
                {{ unit.rooms || '—' }}к · {{ fmtArea(unit.area) }} · {{ unit.floor }} этаж
              </p>
            </template>
          </div>

          <!-- этаж вверх-вниз: клиент ходит по дому, не закрывая панель -->
          <div v-if="view === 'floor'" class="flex shrink-0 items-center gap-1">
            <span class="tabular text-[14px] font-semibold text-ink">{{ floor }} / {{ maxFloor }}</span>
            <div class="flex flex-col">
              <button
                class="focus-ring grid h-4 w-6 place-items-center rounded text-muted hover:text-ink disabled:opacity-30"
                :disabled="floor >= maxFloor" title="Этаж выше" @click="stepFloor(1)"
              ><Icon name="ph:caret-up" size="12" /></button>
              <button
                class="focus-ring grid h-4 w-6 place-items-center rounded text-muted hover:text-ink disabled:opacity-30"
                :disabled="floor <= 1" title="Этаж ниже" @click="stepFloor(-1)"
              ><Icon name="ph:caret-down" size="12" /></button>
            </div>
          </div>

          <button
            class="focus-ring grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted hover:bg-soft hover:text-ink"
            title="Закрыть" @click="emit('close')"
          ><Icon name="ph:x" size="16" /></button>
        </header>

        <!-- ЭТАЖ -->
        <div v-if="view === 'floor'" class="min-h-0 flex-1 overflow-y-auto">
          <div class="px-4 pt-3">
            <div v-if="plan?.imageUrl" class="overflow-hidden rounded-xl2 border border-line bg-soft">
              <UnitZoneCanvas
                :image-url="plan.imageUrl" :marks="planMarks" :controls="false" :show-labels="false"
                height="176px" :highlight-id="hoverId"
                @pick="emit('update:unit', $event)" @hover="hoverId = $event"
              >
                <template #tip="{ mark }">
                  <p class="text-[12.5px] font-semibold text-ink">{{ mark.label }}</p>
                  <p class="text-[11.5px] text-muted">{{ mark.sublabel }}</p>
                </template>
              </UnitZoneCanvas>
            </div>
            <div v-else class="grid h-[120px] place-items-center rounded-xl2 border border-dashed border-line text-[12px] text-muted">
              План {{ floor }} этажа не загружен
            </div>

            <button
              type="button"
              class="focus-ring mt-2 w-full rounded-lg py-1.5 text-center text-[12.5px] font-semibold text-plum hover:bg-soft"
              @click="emit('open-plan', floor)"
            >Открыть план этажа</button>
          </div>

          <div class="flex items-baseline justify-between gap-2 px-4 pb-2 pt-3">
            <p class="text-[13px] text-muted">
              Найдено: <b class="text-ink">{{ floorUnits.length }}</b>
              {{ pluralRu(floorUnits.length, 'помещение', 'помещения', 'помещений') }}
            </p>
            <p class="text-[12px] text-ok">свободно {{ freeCount }}</p>
          </div>

          <!-- планировки этажа -->
          <div class="flex flex-col gap-2 px-4 pb-4">
            <button
              v-for="u in floorUnits" :key="u.id" type="button"
              class="focus-ring flex items-center gap-3 rounded-card border bg-panel p-2.5 text-left transition-all hover:-translate-y-px hover:shadow-card"
              :class="hoverId === u.id ? 'border-plum' : 'border-line'"
              @click="emit('update:unit', u.id)"
              @mouseenter="hoverId = u.id"
              @mouseleave="hoverId = null"
            >
              <span class="grid h-[62px] w-[62px] shrink-0 place-items-center overflow-hidden rounded-xl2 border border-line bg-soft">
                <img v-if="thumbOf(u)" :src="thumbOf(u)!" class="h-full w-full object-contain" :alt="`Планировка № ${u.number}`">
                <Icon v-else name="ph:floor-plan" size="20" class="text-muted" />
              </span>

              <span class="min-w-0 flex-1">
                <span class="tabular block text-[17px] font-semibold leading-tight text-ink">{{ money(u.price) }}</span>
                <span class="tabular block text-[11.5px] text-muted">{{ money(perM2(u)) }}/м²</span>
                <span class="mt-0.5 block text-[11.5px] text-muted">
                  {{ u.rooms || '—' }}к · {{ fmtArea(u.area) }} · № {{ u.number }}
                </span>
              </span>

              <span class="shrink-0 text-right">
                <StatusTag :tone="UNIT_STATUS_META[u.status].tone" size="sm">{{ UNIT_STATUS_META[u.status].label }}</StatusTag>
                <span class="mt-1 block text-[11px] text-muted">{{ u.floor }} этаж</span>
              </span>
            </button>

            <EmptyState
              v-if="!floorUnits.length" compact icon="ph:stack"
              title="На этом этаже нет помещений в продаже"
            />
          </div>
        </div>

        <!-- КВАРТИРА -->
        <div v-else-if="unit" class="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-3">
          <StatusTag :tone="UNIT_STATUS_META[unit.status].tone" dot>{{ UNIT_STATUS_META[unit.status].label }}</StatusTag>

          <div class="mt-3 grid aspect-[4/3] place-items-center overflow-hidden rounded-card border border-line bg-soft">
            <img v-if="thumbOf(unit)" :src="thumbOf(unit)!" class="h-full w-full object-contain" :alt="`Планировка № ${unit.number}`">
            <div v-else class="flex flex-col items-center gap-1.5 text-muted">
              <Icon name="ph:floor-plan" size="26" />
              <span class="text-[12px]">Планировка не загружена</span>
            </div>
          </div>

          <div class="mt-3 flex items-end justify-between gap-3">
            <div>
              <p class="flex items-center gap-1 text-[12.5px] text-muted">
                Стоимость по прайсу
                <Icon name="ph:info" size="13" :title="`Базовая цена ${money(unit.basePrice || unit.price)}`" />
              </p>
              <p class="tabular text-[11.5px] text-muted">{{ money(perM2(unit)) }}/м²</p>
            </div>
            <p class="tabular text-[22px] font-semibold leading-none tracking-[-0.02em] text-ink">{{ money(unit.price) }}</p>
          </div>

          <div class="mt-3 flex gap-2">
            <AppButton
              variant="primary" block icon="ph:bookmark-simple" :disabled="unit.status !== 'free'"
              @click="emit('reserve', unit.id)"
            >Забронировать</AppButton>
            <button
              type="button"
              class="focus-ring grid h-10 w-10 shrink-0 place-items-center rounded-xl2 border transition-colors"
              :class="isSelected ? 'border-ink bg-ink text-panel' : 'border-line text-muted hover:text-ink'"
              title="В подборку" @click="board.toggleSelect(scopeKey, unit.id)"
            ><Icon name="ph:check-square" size="17" /></button>
            <AppButton icon="ph:arrow-square-out" title="Полная карточка" @click="emit('open', unit.id)" />
          </div>

          <Tabs
            :model-value="tab" class="mt-4"
            :tabs="[
              { value: 'specs', label: 'Характеристики' },
              { value: 'rooms', label: 'Экспликация', count: explication.rooms.length || undefined },
              { value: 'history', label: 'История', count: history.length || undefined },
            ]"
            @update:model-value="tab = $event as typeof tab"
          />

          <dl v-if="tab === 'specs'" class="pt-2">
            <div v-for="[label, value] in specs" :key="label" class="flex items-baseline justify-between gap-3 border-b border-line py-2 last:border-0">
              <dt class="shrink-0 text-[12px] text-muted">{{ label }}</dt>
              <dd class="truncate text-right text-[12.5px] font-medium text-ink">{{ value }}</dd>
            </div>
          </dl>

          <div v-else-if="tab === 'rooms'" class="pt-2">
            <table v-if="explication.rooms.length" class="w-full border-collapse text-[12.5px]">
              <tbody>
                <tr v-for="r in explication.rooms" :key="r.id" class="border-b border-line">
                  <td class="py-1.5 text-muted">{{ roomLabel(r) }}</td>
                  <td class="tabular py-1.5 text-right font-semibold">{{ r.area }} м²</td>
                </tr>
                <tr class="bg-soft">
                  <td class="py-1.5 pl-1 font-semibold">Итого</td>
                  <td class="tabular py-1.5 pr-1 text-right font-bold">{{ explicationTotal.total }} м²</td>
                </tr>
              </tbody>
            </table>
            <p v-else class="py-2 text-[12px] text-muted">Экспликация не заполнена</p>
          </div>

          <div v-else class="flex flex-col pt-2">
            <div v-for="h in history" :key="h.id" class="flex items-start gap-2 border-b border-line py-2 last:border-0">
              <Icon :name="h.kind === 'price' ? 'ph:tag' : 'ph:flag'" size="13" class="mt-0.5 shrink-0 text-muted" />
              <div class="min-w-0 flex-1">
                <p class="text-[12px] text-ink">
                  <template v-if="h.kind === 'price'">{{ money(Number(h.from ?? 0)) }} → {{ money(Number(h.to ?? 0)) }}</template>
                  <template v-else>{{ h.note ?? h.kind }}</template>
                </p>
                <p class="text-[11px] text-muted">{{ fmtDateTime(h.at) }} · {{ h.author }}</p>
              </div>
            </div>
            <p v-if="!history.length" class="py-2 text-[12px] text-muted">Изменений пока не было</p>
          </div>
        </div>
      </aside>
    </Transition>
  </Teleport>
</template>
