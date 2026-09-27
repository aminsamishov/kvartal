<script setup lang="ts">
import type { FacadeMark, ImageZone } from '~/types/models'
import { FACADE_TAG_META, UNIT_BOARD_COLOR, UNIT_STATUS_META } from '~/utils/meta'
import { readableInk } from '~/utils/color'
import type { ZoneOption } from '~/components/units/ImageZoneEditor.vue'

const route = useRoute()
const unitsStore = useUnitsStore()
const ui = useUiStore()

const building = computed(() => unitsStore.building(route.params.buildingId as string))
const project = computed(() => (building.value ? unitsStore.project(building.value.projectId) : undefined))
const facade = computed(() => building.value?.facades.find((f) => f.id === route.params.facadeId))

useBreadcrumb(() => [
  { label: 'Мои объекты', to: '/objects' },
  { label: project.value?.name ?? '…', to: `/objects/${project.value?.id}` },
  { label: building.value?.name ?? '…', to: `/buildings/${building.value?.id}` },
  { label: facade.value?.name ?? 'Разметка фасада' },
])

// На фасаде размечают и этажи (быстрая раскраска по стадиям продаж), и
// отдельные помещения (покупатель кликает в окно своей квартиры). Оба вида
// областей живут в одном списке, поэтому refId несёт префикс вида.
const mode = ref<'floor' | 'unit'>('floor')
const unitFloor = ref<number | null>(null)

const floorsDesc = computed(() => {
  const b = building.value
  return b ? Array.from({ length: b.floors }, (_, i) => b.floors - i) : []
})

function markFor(floor: number): FacadeMark {
  return building.value?.facadeMarks.find((m) => m.floor === floor) ?? { floor, color: '#B4ADA4', label: '' }
}

const floorOptions = computed<ZoneOption[]>(() => floorsDesc.value.map((floor) => {
  const onFloor = unitsStore.units.filter((u) => u.buildingId === building.value?.id && u.floor === floor)
  const free = onFloor.filter((u) => u.status === 'free').length
  return {
    value: `floor:${floor}`,
    label: `Этаж ${floor}`,
    color: markFor(floor).color || '#B4ADA4',
    hint: [markFor(floor).label, onFloor.length ? `${onFloor.length} помещ., свободно ${free}` : null].filter(Boolean).join(' · '),
  }
}))

const unitOptions = computed<ZoneOption[]>(() => unitsStore.units
  .filter((u) => u.buildingId === building.value?.id && u.floor > 0 && (unitFloor.value === null || u.floor === unitFloor.value))
  .sort((a, b) => b.floor - a.floor || a.number.localeCompare(b.number, undefined, { numeric: true }))
  .map((u) => ({
    value: `unit:${u.id}`,
    label: `№ ${u.number}`,
    color: UNIT_BOARD_COLOR[u.status],
    hint: `Этаж ${u.floor} · ${u.rooms || '—'} комн. · ${u.area} м² · ${UNIT_STATUS_META[u.status].label}`,
  })))

const activeOptions = computed(() => (mode.value === 'floor' ? floorOptions.value : unitOptions.value))
const prefix = computed(() => (mode.value === 'floor' ? 'floor:' : 'unit:'))
const activeZones = computed(() => facade.value?.zones.filter((z) => z.refId.startsWith(prefix.value)) ?? [])

function onZonesUpdate(zones: ImageZone[]) {
  if (!building.value || !facade.value) return
  const others = facade.value.zones.filter((z) => !z.refId.startsWith(prefix.value))
  unitsStore.setFacadeZones(building.value.id, facade.value.id, [...others, ...zones])
}

/* --- условная схема этажности: раскраска этажей без привязки к фото --- */
const PALETTE = [
  { color: '#34495A', label: 'Продано' },
  { color: '#8C5566', label: 'В рассрочке' },
  { color: '#C9821A', label: 'Бронь' },
  { color: '#2F7D5C', label: 'Свободно' },
  { color: '#6D6772', label: 'Не в продаже' },
]

function setMark(floor: number, patch: Partial<FacadeMark>) {
  if (!building.value) return
  const marks = building.value.facadeMarks.filter((m) => m.floor !== floor)
  marks.push({ ...markFor(floor), ...patch })
  unitsStore.setFacadeMarks(building.value.id, marks)
}

const bulkFrom = ref(1)
const bulkTo = ref(1)
watchEffect(() => { if (building.value) bulkTo.value = building.value.floors })

function markRange(preset: typeof PALETTE[number]) {
  if (!building.value) return
  const from = Math.min(bulkFrom.value, bulkTo.value)
  const to = Math.max(bulkFrom.value, bulkTo.value)
  const marks = building.value.facadeMarks.filter((m) => m.floor < from || m.floor > to)
  for (let f = from; f <= to; f++) marks.push({ floor: f, color: preset.color, label: preset.label })
  unitsStore.setFacadeMarks(building.value.id, marks)
  ui.toast(`Этажи ${from}–${to}: «${preset.label}»`, 'ok')
}

/** Раскрасить этажи по фактическим статусам помещений. */
function autoColorFloors() {
  const b = building.value
  if (!b) return
  const marks: FacadeMark[] = []
  for (let f = 1; f <= b.floors; f++) {
    const onFloor = unitsStore.units.filter((u) => u.buildingId === b.id && u.floor === f)
    if (!onFloor.length) continue
    const free = onFloor.filter((u) => u.status === 'free').length
    const share = free / onFloor.length
    const preset = share === 0 ? PALETTE[0]! : share < 0.35 ? PALETTE[1]! : share < 0.7 ? PALETTE[2]! : PALETTE[3]!
    marks.push({ floor: f, color: preset.color, label: preset.label })
  }
  unitsStore.setFacadeMarks(b.id, marks)
  ui.toast('Этажи раскрашены по статусам помещений', 'ok')
}

function togglePublish() {
  if (!building.value || !facade.value) return
  unitsStore.toggleFacadePublished(building.value.id, facade.value.id)
}
</script>

<template>
  <div v-if="building && facade" class="flex flex-col gap-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0">
        <div class="flex flex-wrap items-center gap-2">
          <h1 class="text-[22px] font-semibold tracking-[-0.025em]">{{ facade.name }}</h1>
          <StatusTag tone="plum" size="sm" :icon="FACADE_TAG_META[facade.tag].icon">{{ FACADE_TAG_META[facade.tag].label }}</StatusTag>
          <StatusTag :tone="facade.published ? 'ok' : 'neutral'" size="sm" dot>{{ facade.published ? 'Опубликован' : 'Не опубликован' }}</StatusTag>
        </div>
        <p class="mt-1 text-[13px] text-muted">{{ project?.name }} · {{ building.name }} · {{ facade.zones.length }} размеченных областей</p>
      </div>
      <div class="flex shrink-0 gap-2">
        <AppButton icon="ph:arrow-left" @click="navigateTo(`/buildings/${building.id}?tab=facade`)">К списку ракурсов</AppButton>
        <AppButton :variant="facade.published ? 'default' : 'primary'" :icon="facade.published ? 'ph:eye-slash' : 'ph:globe'" @click="togglePublish">
          {{ facade.published ? 'Снять с публикации' : 'Опубликовать' }}
        </AppButton>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <AppCard v-if="facade.imageUrl" flush :padded="false">
        <div class="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
          <SegmentedControl
            :model-value="mode"
            :options="[{ value: 'floor', label: 'Привязка к этажам', icon: 'ph:stack' }, { value: 'unit', label: 'Привязка к помещениям', icon: 'ph:door' }]"
            @update:model-value="mode = $event as 'floor' | 'unit'"
          />
          <label v-if="mode === 'unit'" class="flex items-center gap-1.5 text-[12px] font-medium text-muted">
            Этаж
            <select
              class="focus-ring rounded-lg border border-line bg-panel px-2 py-1.5 text-[12.5px] font-semibold text-ink"
              :value="unitFloor === null ? '' : String(unitFloor)"
              @change="unitFloor = ($event.target as HTMLSelectElement).value === '' ? null : Number(($event.target as HTMLSelectElement).value)"
            >
              <option value="">Все этажи</option>
              <option v-for="f in floorsDesc" :key="f" :value="f">{{ f }}</option>
            </select>
          </label>
        </div>
        <div class="p-5">
          <ImageZoneEditor
            :image-url="facade.imageUrl" :zones="activeZones" :options="activeOptions"
            :entity-label="mode === 'floor' ? 'этаж' : 'помещение'"
            :empty-options-hint="mode === 'floor' ? 'Все этажи размечены — выберите этаж в списке, чтобы перерисовать' : 'Все помещения этого этажа размечены'"
            @update:zones="onZonesUpdate"
          />
        </div>
      </AppCard>

      <EmptyState v-else icon="ph:image-square" title="Изображение не загружено" text="Загрузите фото или рендер этого ракурса в списке фасадов — после этого появится разметка">
        <template #action><AppButton size="sm" @click="navigateTo(`/buildings/${building.id}?tab=facade`)">К списку ракурсов</AppButton></template>
      </EmptyState>

      <div class="flex flex-col gap-4">
        <AppCard title="Условная схема этажности" subtitle="Работает и без фото: цвет этажа виден в шахматке и на витрине">
          <template #actions>
            <AppButton size="sm" icon="ph:magic-wand" @click="autoColorFloors">Авто</AppButton>
          </template>
          <div class="flex flex-col-reverse overflow-hidden rounded-xl2 border border-line">
            <div
              v-for="floor in [...floorsDesc].reverse()" :key="floor"
              class="flex items-center justify-between gap-2 px-2.5 text-[11.5px] font-semibold"
              :style="{
                background: markFor(floor).color || 'var(--soft)', height: '24px',
                color: building.facadeMarks.some((m) => m.floor === floor) ? readableInk(markFor(floor).color) : 'var(--muted)',
              }"
            >
              <span class="tabular">{{ floor }}</span>
              <span class="truncate">{{ markFor(floor).label || '—' }}</span>
            </div>
          </div>

          <div class="mt-3.5 grid grid-cols-2 gap-2">
            <AppInput v-model.number="bulkFrom" type="number" label="С этажа" />
            <AppInput v-model.number="bulkTo" type="number" label="По этаж" />
          </div>
          <div class="mt-2.5 flex flex-wrap gap-1.5">
            <button
              v-for="p in PALETTE" :key="p.label" type="button"
              class="focus-ring flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1.5 text-[11.5px] font-medium hover:bg-soft"
              @click="markRange(p)"
            >
              <span class="h-2.5 w-2.5 rounded-full" :style="{ background: p.color }" /> {{ p.label }}
            </button>
          </div>
        </AppCard>

        <AppCard title="Цвет отдельного этажа">
          <div class="flex max-h-[320px] flex-col gap-2 overflow-y-auto pr-1">
            <div v-for="floor in floorsDesc" :key="floor" class="flex items-center gap-2">
              <span class="tabular w-6 shrink-0 text-right text-[12px] font-semibold text-muted">{{ floor }}</span>
              <input
                type="color" :value="markFor(floor).color" class="h-8 w-9 shrink-0 cursor-pointer rounded-lg border border-line p-0.5"
                @input="setMark(floor, { color: ($event.target as HTMLInputElement).value })"
              >
              <input
                :value="markFor(floor).label" placeholder="Метка" class="focus-ring h-8 min-w-0 flex-1 rounded-lg border border-line bg-panel px-2 text-[12.5px]"
                @change="setMark(floor, { label: ($event.target as HTMLInputElement).value })"
              >
            </div>
          </div>
        </AppCard>
      </div>
    </div>
  </div>
  <EmptyState v-else icon="ph:question" title="Ракурс фасада не найден" class="mt-10" />
</template>
