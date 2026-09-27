<script setup lang="ts">
import type { Building, ImageZone } from '~/types/models'
import { fileToObjectUrl, pickFiles } from '~/composables/useFileUpload'
import { UNIT_BOARD_COLOR, UNIT_STATUS_META } from '~/utils/meta'
import { zonePointsAttr } from '~/utils/zones'
import type { ZoneOption } from '~/components/units/ImageZoneEditor.vue'

const props = defineProps<{ building: Building }>()
const unitsStore = useUnitsStore()
const ui = useUiStore()

const floorsDesc = computed(() => Array.from({ length: props.building.floors }, (_, i) => props.building.floors - i))

function planFor(floor: number) {
  return props.building.floorPlans.find((f) => f.floor === floor)
}
function zonesOf(floor: number) {
  return planFor(floor)?.zones ?? []
}
function unitsOn(floor: number) {
  return unitsStore.units.filter((u) => u.buildingId === props.building.id && u.floor === floor)
}

async function upload(floor: number) {
  const [file] = await pickFiles('image/*')
  if (!file) return
  unitsStore.setFloorPlanImage(props.building.id, floor, fileToObjectUrl(file))
  ui.toast(`План ${floor} этажа загружен`, 'ok')
}

/** Загрузка пачкой: файлы раскладываются по этажам снизу вверх. */
async function uploadMany() {
  const files = await pickFiles('image/*', true)
  if (!files.length) return
  const sorted = [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
  sorted.forEach((file, i) => {
    const floor = i + 1
    if (floor > props.building.floors) return
    unitsStore.setFloorPlanImage(props.building.id, floor, fileToObjectUrl(file))
  })
  ui.toast(`Загружено планов: ${Math.min(sorted.length, props.building.floors)} (этажи 1–${Math.min(sorted.length, props.building.floors)})`, 'ok')
}

function remove(floor: number) {
  unitsStore.setFloorPlanImage(props.building.id, floor, null)
}
function rename(floor: number, name: string) {
  unitsStore.setFloorPlanImage(props.building.id, floor, planFor(floor)?.imageUrl ?? null, name)
}

/* ------------------------------ разметка этажа ----------------------------- */

const zoneFloor = ref<number | null>(null)

const zoneOptions = computed<ZoneOption[]>(() => {
  if (zoneFloor.value === null) return []
  return unitsOn(zoneFloor.value)
    .slice()
    .sort((a, b) => a.section - b.section || a.number.localeCompare(b.number, undefined, { numeric: true }))
    .map((u) => ({
      value: u.id,
      label: `№ ${u.number}`,
      color: UNIT_BOARD_COLOR[u.status],
      hint: `Секция ${u.section || '—'} · ${u.rooms || '—'} комн. · ${u.area} м² · ${UNIT_STATUS_META[u.status].label}`,
    }))
})

function onZonesUpdate(zones: ImageZone[]) {
  if (zoneFloor.value === null) return
  unitsStore.setFloorPlanZones(props.building.id, zoneFloor.value, zones)
}

/* --------------------- копирование разметки типового этажа ------------------ */

const copyFrom = ref<number | null>(null)
const copyTo = reactive({ from: 1, to: 1, withImage: true })

function openCopy(floor: number) {
  copyFrom.value = floor
  copyTo.from = Math.max(1, floor - 1)
  copyTo.to = Math.max(1, floor - 1)
}

/**
 * Типовые этажи повторяются — переносим и картинку, и контуры, но refId
 * пересчитываем на помещения этажа-получателя по порядку, иначе области
 * ссылались бы на квартиры чужого этажа.
 */
function applyCopy() {
  const src = copyFrom.value
  if (src === null) return
  const plan = planFor(src)
  if (!plan) return
  const srcUnits = unitsOn(src).slice().sort((a, b) => a.section - b.section || a.number.localeCompare(b.number, undefined, { numeric: true }))
  const from = Math.min(copyTo.from, copyTo.to)
  const to = Math.max(copyTo.from, copyTo.to)
  let done = 0
  for (let f = from; f <= to; f++) {
    if (f === src || f < 1 || f > props.building.floors) continue
    if (copyTo.withImage) unitsStore.setFloorPlanImage(props.building.id, f, plan.imageUrl, `Этаж ${f}`)
    const targetUnits = unitsOn(f).slice().sort((a, b) => a.section - b.section || a.number.localeCompare(b.number, undefined, { numeric: true }))
    const mapped: ImageZone[] = []
    plan.zones.forEach((z) => {
      const idx = srcUnits.findIndex((u) => u.id === z.refId)
      const target = idx >= 0 ? targetUnits[idx] : undefined
      if (!target) return
      mapped.push({
        ...z,
        id: `${props.building.id}-fp${f}-${target.id}`,
        points: z.points.map((p) => ({ ...p })),
        refId: target.id,
        label: `№ ${target.number}`,
        color: UNIT_BOARD_COLOR[target.status],
      })
    })
    unitsStore.setFloorPlanZones(props.building.id, f, mapped)
    done++
  }
  ui.toast(done ? `Разметка перенесена на ${done} этаж(ей)` : 'Не выбрано ни одного этажа', done ? 'ok' : 'warn')
  copyFrom.value = null
}

const withImage = computed(() => props.building.floorPlans.filter((f) => f.imageUrl).length)
const withZones = computed(() => props.building.floorPlans.filter((f) => f.imageUrl && f.zones.length).length)
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-wrap items-start justify-between gap-3 rounded-card border border-line bg-soft p-4">
      <div class="flex gap-3">
        <Icon name="ph:info" size="18" class="mt-0.5 shrink-0 text-muted" />
        <div class="text-[12.5px] leading-relaxed text-muted">
          <p>Загрузите поэтажные планы и обведите контуры помещений <b class="text-ink">по точкам</b> — покупатель на витрине наводит курсор на квартиру и видит её статус и цену.</p>
          <p class="mt-0.5">
            Планов загружено: <b class="text-ink">{{ withImage }}</b> из {{ building.floors }} · размечено: <b class="text-ink">{{ withZones }}</b>.
            Для типовых этажей достаточно разметить один и скопировать.
          </p>
        </div>
      </div>
      <AppButton size="sm" variant="primary" icon="ph:upload-simple" class="shrink-0" @click="uploadMany">Загрузить пачкой</AppButton>
    </div>

    <div class="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
      <article v-for="floor in floorsDesc" :key="floor" class="overflow-hidden rounded-card border border-line bg-panel shadow-card transition-shadow hover:shadow-rise">
        <div class="group relative aspect-[16/10] bg-soft">
          <template v-if="planFor(floor)?.imageUrl">
            <img :src="planFor(floor)!.imageUrl!" class="h-full w-full object-cover" :alt="`План ${floor} этажа`">
            <svg class="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1 1" preserveAspectRatio="none">
              <polygon
                v-for="z in zonesOf(floor)" :key="z.id" :points="zonePointsAttr(z)"
                vector-effect="non-scaling-stroke" :style="{ fill: z.color, fillOpacity: 0.3, stroke: z.color, strokeWidth: 1.2 }"
              />
            </svg>
            <div class="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-ink/55 opacity-0 transition-opacity group-hover:opacity-100">
              <AppButton size="sm" variant="primary" icon="ph:polygon" @click="zoneFloor = floor">Разметить помещения</AppButton>
              <div class="flex gap-1.5">
                <button class="grid h-8 w-8 place-items-center rounded-lg bg-panel/90 text-ink" title="Заменить файл" @click="upload(floor)"><Icon name="ph:arrow-clockwise" size="15" /></button>
                <button class="grid h-8 w-8 place-items-center rounded-lg bg-panel/90 text-ink" title="Скопировать на другие этажи" @click="openCopy(floor)"><Icon name="ph:copy" size="15" /></button>
                <button class="grid h-8 w-8 place-items-center rounded-lg bg-panel/90 text-bad" title="Удалить план" @click="remove(floor)"><Icon name="ph:trash" size="15" /></button>
              </div>
            </div>
            <span
              class="absolute bottom-2 left-2 flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold text-white"
              :class="zonesOf(floor).length ? 'bg-fill-ok' : 'bg-ink/70'"
            >
              <Icon :name="zonesOf(floor).length ? 'ph:check-circle' : 'ph:polygon'" size="12" />
              {{ zonesOf(floor).length ? `${zonesOf(floor).length} из ${unitsOn(floor).length} размечено` : 'без разметки' }}
            </span>
          </template>
          <button v-else type="button" class="flex h-full w-full flex-col items-center justify-center gap-2 text-muted transition-colors hover:bg-plum-soft hover:text-plum" @click="upload(floor)">
            <Icon name="ph:upload-simple" size="24" />
            <span class="text-[12.5px] font-semibold">Загрузить план {{ floor }} этажа</span>
          </button>
        </div>
        <div class="flex items-center gap-2 border-t border-line p-2.5">
          <span class="tabular grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-soft text-[12px] font-bold text-muted">{{ floor }}</span>
          <input
            :value="planFor(floor)?.name ?? `Этаж ${floor}`"
            class="focus-ring min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-[12.5px] font-medium hover:border-line focus:border-line"
            @change="rename(floor, ($event.target as HTMLInputElement).value)"
          >
          <span class="shrink-0 text-[11.5px] text-muted">{{ unitsOn(floor).length }} помещ.</span>
        </div>
      </article>
    </div>

    <EmptyState v-if="!building.floors" compact icon="ph:stack" title="У дома не указано число этажей" text="Укажите этажность в карточке дома — после этого появятся слоты для планов" />

    <!-- разметка помещений на плане -->
    <AppModal
      :model-value="zoneFloor !== null" width="xl"
      :title="`Разметка помещений — ${planFor(zoneFloor ?? 0)?.name ?? `этаж ${zoneFloor}`}`"
      @update:model-value="zoneFloor = null"
    >
      <ImageZoneEditor
        v-if="zoneFloor !== null && planFor(zoneFloor)?.imageUrl"
        :image-url="planFor(zoneFloor)!.imageUrl!" :zones="zonesOf(zoneFloor)" :options="zoneOptions"
        empty-options-hint="Все помещения этажа размечены — выберите номер в списке, чтобы перерисовать"
        @update:zones="onZonesUpdate"
      />
    </AppModal>

    <!-- копирование на типовые этажи -->
    <AppModal :model-value="copyFrom !== null" :title="`Скопировать план ${copyFrom} этажа`" width="sm" @update:model-value="copyFrom = null">
      <p class="text-[12.5px] leading-relaxed text-muted">
        Контуры перенесутся на помещения выбранных этажей по порядку номеров — так типовой этаж размечается один раз.
      </p>
      <div class="mt-3.5 grid grid-cols-2 gap-3">
        <AppInput v-model.number="copyTo.from" type="number" label="С этажа" />
        <AppInput v-model.number="copyTo.to" type="number" label="По этаж" />
      </div>
      <label class="mt-3 flex cursor-pointer items-center gap-2 text-[12.5px]">
        <input v-model="copyTo.withImage" type="checkbox" class="accent-plum"> Скопировать и само изображение плана
      </label>
      <div class="mt-4 flex gap-2">
        <AppButton block @click="copyFrom = null">Отмена</AppButton>
        <AppButton block variant="primary" icon="ph:copy" @click="applyCopy">Скопировать</AppButton>
      </div>
    </AppModal>
  </div>
</template>
