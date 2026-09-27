<script setup lang="ts">
import type { Building, CompassSide, ExplicationRoom, UnitTypePreset } from '~/types/models'
import { COMPASS_SIDES } from '~/types/models'
import { fileToObjectUrl, pickFiles } from '~/composables/useFileUpload'
import { explicationTotals } from '~/utils/explication'
import { area as fmtArea } from '~/utils/format'

const props = defineProps<{ building: Building }>()
const unitsStore = useUnitsStore()
const ui = useUiStore()

const showCreate = ref(false)
const form = reactive({ name: '', rooms: 1, area: 40 })
function createPreset() {
  if (!form.name.trim()) { ui.toast('Укажите название планировки', 'warn'); return }
  unitsStore.addUnitTypePreset(props.building.id, {
    name: form.name, rooms: form.rooms, area: form.area, imageUrl: null, orientation: [], visible: true,
  })
  showCreate.value = false
  ui.toast('Планировка добавлена — экспликация заполнена типовым набором комнат', 'ok')
  form.name = ''; form.rooms = 1; form.area = 40
}

async function uploadImage(preset: UnitTypePreset) {
  const [file] = await pickFiles('image/*')
  if (!file) return
  if (file.size > 5 * 1024 * 1024) { ui.toast('Файл больше 5 МБ', 'warn'); return }
  unitsStore.updateUnitTypePreset(props.building.id, preset.id, { imageUrl: fileToObjectUrl(file) })
}
function removeImage(preset: UnitTypePreset) {
  unitsStore.updateUnitTypePreset(props.building.id, preset.id, { imageUrl: null })
}

const confirmRemove = ref<UnitTypePreset | null>(null)
function doRemove() {
  if (!confirmRemove.value) return
  unitsStore.removeUnitTypePreset(props.building.id, confirmRemove.value.id)
  ui.toast('Планировка удалена, привязки помещений сняты', 'info')
  confirmRemove.value = null
}

function patchField(preset: UnitTypePreset, field: 'name' | 'area' | 'rooms', value: string) {
  if (field === 'name') { unitsStore.updateUnitTypePreset(props.building.id, preset.id, { name: value }); return }
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) return
  unitsStore.updateUnitTypePreset(props.building.id, preset.id, { [field]: field === 'rooms' ? Math.round(n) : n })
}

function toggleSide(preset: UnitTypePreset, side: CompassSide) {
  const set = new Set(preset.orientation)
  if (set.has(side)) set.delete(side)
  else set.add(side)
  unitsStore.updateUnitTypePreset(props.building.id, preset.id, { orientation: [...set] })
}

const pickerOpen = ref(false)
const pickerPreset = ref<UnitTypePreset | null>(null)
function openPicker(preset: UnitTypePreset) {
  pickerPreset.value = preset
  pickerOpen.value = true
}

const orientationOpenFor = ref<string | null>(null)
const explicationOpenFor = ref<string | null>(null)
const preview = ref<UnitTypePreset | null>(null)
const marking = ref<UnitTypePreset | null>(null)

function openMarking(p: UnitTypePreset) {
  if (!p.imageUrl) { ui.toast('Сначала загрузите изображение планировки', 'warn'); return }
  if (!p.explication.length) { ui.toast('Сначала заполните экспликацию — области привязываются к её строкам', 'warn'); return }
  marking.value = p
}
function onRoomZones(presetId: string, zones: import('~/types/models').ImageZone[]) {
  unitsStore.setPresetRoomZones(props.building.id, presetId, zones)
}

function setExplication(preset: UnitTypePreset, rooms: ExplicationRoom[]) {
  unitsStore.setPresetExplication(props.building.id, preset.id, rooms)
}
function fillTemplate(preset: UnitTypePreset) {
  unitsStore.fillPresetExplicationFromTemplate(props.building.id, preset.id)
  ui.toast('Экспликация собрана под площадь планировки', 'ok')
}
function applyAreaToPreset(preset: UnitTypePreset, value: number) {
  unitsStore.updateUnitTypePreset(props.building.id, preset.id, { area: value })
  ui.toast(`Площадь планировки — ${value} м²`, 'ok')
}

/** Разослать площадь планировки во все привязанные помещения. */
function pushAreaToUnits(preset: UnitTypePreset) {
  const linked = unitsStore.unitsForPreset(preset.id)
  const editable = linked.filter((u) => u.status !== 'sold' && u.status !== 'installment')
  for (const u of editable) unitsStore.patchUnit(u.id, { area: preset.area })
  ui.toast(
    editable.length
      ? `Площадь ${preset.area} м² записана в ${editable.length} помещ.${linked.length - editable.length ? ` (${linked.length - editable.length} проданных пропущено)` : ''}`
      : 'Нет помещений, доступных для правки',
    editable.length ? 'ok' : 'warn',
  )
}

function totalsOf(preset: UnitTypePreset) {
  return explicationTotals(preset.explication)
}
const linkedCount = (preset: UnitTypePreset) => unitsStore.unitsForPreset(preset.id).length
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-wrap items-start justify-between gap-3 rounded-card border border-line bg-soft p-4">
      <div class="flex gap-3">
        <Icon name="ph:info" size="18" class="mt-0.5 shrink-0 text-muted" />
        <div class="max-w-3xl text-[12.5px] leading-relaxed text-muted">
          <p>Планировка — это изображение и <b class="text-ink">экспликация</b> (ведомость комнат), общие для группы помещений. Рекомендуемый размер картинки 1000×1000 px без пустых полей, JPG/PNG, до 5 МБ.</p>
          <p class="mt-0.5">Для каждой секции планировку загружают отдельным файлом, даже если она типовая — у зеркальных квартир разные виды из окон.</p>
        </div>
      </div>
      <AppButton variant="primary" icon="ph:plus-bold" class="shrink-0" @click="showCreate = true">Новая планировка</AppButton>
    </div>

    <div v-if="building.unitTypePresets.length" class="flex flex-col gap-3">
      <article v-for="p in building.unitTypePresets" :key="p.id" class="rounded-card border border-line bg-panel shadow-card transition-shadow hover:shadow-rise">
        <div class="flex flex-col gap-4 p-4 lg:flex-row">
          <!-- изображение -->
          <div class="group relative aspect-square w-full shrink-0 overflow-hidden rounded-xl2 border border-line bg-soft lg:w-[136px]">
            <img v-if="p.imageUrl" :src="p.imageUrl" class="h-full w-full cursor-zoom-in object-contain" :alt="p.name" @click="preview = p">
            <button v-else type="button" class="flex h-full w-full flex-col items-center justify-center gap-1.5 text-muted hover:text-plum" @click="uploadImage(p)">
              <Icon name="ph:image-square" size="22" />
              <span class="text-[11.5px] font-medium">Загрузить</span>
            </button>
            <div v-if="p.imageUrl" class="absolute inset-x-0 bottom-0 flex justify-center gap-1 bg-ink/60 p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
              <button class="grid h-7 w-7 place-items-center rounded-lg bg-panel/90 text-ink" title="Заменить" @click="uploadImage(p)"><Icon name="ph:arrow-clockwise" size="13" /></button>
              <button class="grid h-7 w-7 place-items-center rounded-lg bg-panel/90 text-bad" title="Убрать" @click="removeImage(p)"><Icon name="ph:trash" size="13" /></button>
            </div>
          </div>

          <!-- параметры -->
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <input
                :value="p.name"
                class="focus-ring min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-1.5 py-1 text-[15px] font-medium tracking-[-0.015em] hover:border-line focus:border-line"
                placeholder="Название планировки" @change="patchField(p, 'name', ($event.target as HTMLInputElement).value)"
              >
              <StatusTag :tone="p.visible ? 'ok' : 'neutral'" size="sm" dot>{{ p.visible ? 'Видна на витрине' : 'Скрыта' }}</StatusTag>
            </div>

            <div class="mt-2.5 flex flex-wrap items-end gap-3">
              <label class="flex flex-col gap-1 text-[11px] font-medium uppercase tracking-[0.03em] text-muted">
                Комнат
                <input type="number" min="0" :value="p.rooms" class="focus-ring tabular w-[70px] rounded-lg border border-line bg-panel px-2 py-1.5 text-[13.5px] font-semibold text-ink" @change="patchField(p, 'rooms', ($event.target as HTMLInputElement).value)">
              </label>
              <label class="flex flex-col gap-1 text-[11px] font-medium uppercase tracking-[0.03em] text-muted">
                Площадь, м²
                <input type="number" step="0.1" min="0" :value="p.area" class="focus-ring tabular w-[96px] rounded-lg border border-line bg-panel px-2 py-1.5 text-[13.5px] font-semibold text-ink" @change="patchField(p, 'area', ($event.target as HTMLInputElement).value)">
              </label>
              <div class="relative">
                <p class="mb-1 text-[11px] font-medium uppercase tracking-[0.03em] text-muted">Стороны света</p>
                <button type="button" class="focus-ring flex h-[34px] items-center gap-1.5 rounded-lg border border-line px-2.5 text-[12.5px] font-medium hover:bg-soft" @click="orientationOpenFor = orientationOpenFor === p.id ? null : p.id">
                  <Icon name="ph:compass" size="14" /> {{ p.orientation.length ? p.orientation.join(', ') : 'не указаны' }}
                  <Icon name="ph:caret-down" size="11" class="text-muted" />
                </button>
                <div v-if="orientationOpenFor === p.id" class="absolute left-0 top-[62px] z-20 flex w-[232px] flex-wrap gap-1 rounded-xl2 border border-line bg-panel p-2.5 shadow-pop">
                  <Chip v-for="side in COMPASS_SIDES" :key="side" :pressed="p.orientation.includes(side)" @click="toggleSide(p, side)">{{ side }}</Chip>
                </div>
              </div>
              <div>
                <p class="mb-1 text-[11px] font-medium uppercase tracking-[0.03em] text-muted">Комнат на плане</p>
                <p class="tabular h-[34px] text-[13.5px] font-semibold leading-[34px]" :class="p.explication.length && p.roomZones.length >= p.explication.length ? 'text-ok' : 'text-muted'">
                  {{ p.roomZones.length }} / {{ p.explication.length || '—' }}
                </p>
              </div>
              <div>
                <p class="mb-1 text-[11px] font-medium uppercase tracking-[0.03em] text-muted">По экспликации</p>
                <p class="tabular h-[34px] text-[13.5px] font-semibold leading-[34px]" :class="p.explication.length && Math.abs(totalsOf(p).total - p.area) > 0.05 ? 'text-warn' : 'text-ink'">
                  {{ p.explication.length ? `${totalsOf(p).total} м²` : '—' }}
                </p>
              </div>
            </div>

            <div class="mt-3 flex flex-wrap items-center gap-1.5">
              <span class="text-[11.5px] font-medium text-muted">Привязано помещений: <b class="tabular text-ink">{{ linkedCount(p) }}</b></span>
              <span v-for="u in unitsStore.unitsForPreset(p.id).slice(0, 12)" :key="u.id" class="tabular rounded bg-soft px-1.5 py-0.5 text-[11px] text-muted">№{{ u.number }}</span>
              <span v-if="linkedCount(p) > 12" class="text-[11px] text-muted">+{{ linkedCount(p) - 12 }}</span>
              <span v-if="!linkedCount(p)" class="text-[11px] text-muted">— не привязаны</span>
            </div>
          </div>

          <!-- действия -->
          <div class="flex shrink-0 flex-col gap-2 border-t border-line pt-3 lg:w-[212px] lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
            <AppButton size="sm" icon="ph:map-pin-simple-area" @click="openPicker(p)">Отметить на шахматке</AppButton>
            <AppButton size="sm" :icon="explicationOpenFor === p.id ? 'ph:caret-up' : 'ph:list-numbers'" @click="explicationOpenFor = explicationOpenFor === p.id ? null : p.id">
              Экспликация{{ p.explication.length ? ` · ${p.explication.length}` : '' }}
            </AppButton>
            <AppButton size="sm" icon="ph:polygon" @click="openMarking(p)">
              Разметить комнаты{{ p.roomZones.length ? ` · ${p.roomZones.length}` : '' }}
            </AppButton>
            <AppButton size="sm" icon="ph:arrows-out-line-horizontal" :disabled="!linkedCount(p)" @click="pushAreaToUnits(p)">Площадь в помещения</AppButton>
            <div class="rounded-xl2 border border-line px-2.5 py-1.5">
            <AppSwitch :model-value="p.visible" label="Показывать" @update:model-value="unitsStore.togglePresetVisibility(building.id, p.id)" />
          </div>
            <button type="button" class="flex items-center justify-center gap-1.5 text-[11.5px] font-medium text-muted hover:text-bad" @click="confirmRemove = p">
              <Icon name="ph:trash" size="12" /> Удалить планировку
            </button>
          </div>
        </div>

        <!-- экспликация -->
        <div v-if="explicationOpenFor === p.id" class="border-t border-line bg-soft/50 p-4">
          <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p class="text-[13px] font-semibold">Экспликация планировки «{{ p.name }}»</p>
              <p class="text-[11.5px] text-muted">Наследуется всеми привязанными помещениями, пока у них нет своей</p>
            </div>
            <AppButton size="sm" variant="primary" icon="ph:polygon" @click="openMarking(p)">Разметить на планировке</AppButton>
          </div>
          <ExplicationEditor
            :rooms="p.explication" :declared-area="p.area"
            @update:rooms="setExplication(p, $event)" @template="fillTemplate(p)" @apply-area="applyAreaToPreset(p, $event)"
          />
        </div>
      </article>
    </div>

    <EmptyState v-else icon="ph:floor-plan" title="Планировки помещений не добавлены" text="Добавьте типовые планировки, привяжите к ним помещения и заполните экспликацию — она печатается в договоре">
      <template #action><AppButton size="sm" variant="primary" icon="ph:plus-bold" @click="showCreate = true">Новая планировка</AppButton></template>
    </EmptyState>

    <AppModal v-model="showCreate" title="Новая планировка" width="sm">
      <div class="flex flex-col gap-3.5">
        <AppInput v-model="form.name" label="Название" placeholder="2-комн. А" />
        <div class="grid grid-cols-2 gap-3">
          <AppInput v-model.number="form.rooms" type="number" label="Комнат" />
          <AppInput v-model.number="form.area" type="number" label="Площадь, м²" />
        </div>
        <p class="text-[12px] text-muted">Экспликация заполнится типовым набором комнат под указанную площадь — потом её можно поправить построчно.</p>
        <AppButton variant="primary" block icon="ph:plus-bold" @click="createPreset">Добавить</AppButton>
      </div>
    </AppModal>

    <AppModal :model-value="!!preview" :title="preview?.name" width="lg" @update:model-value="preview = null">
      <img v-if="preview?.imageUrl" :src="preview.imageUrl" class="mx-auto max-h-[62vh] w-auto rounded-xl2 border border-line" :alt="preview.name">
      <div v-if="preview" class="mt-4">
        <p class="mb-2 text-[13px] font-semibold">Экспликация · {{ preview.rooms }}-комн., {{ fmtArea(preview.area) }}</p>
        <ExplicationEditor :rooms="preview.explication" readonly />
      </div>
    </AppModal>

    <AppModal
      :model-value="!!marking" width="xl"
      :title="`Разметка комнат — планировка «${marking?.name ?? ''}»`"
      @update:model-value="marking = null"
    >
      <RoomPlanEditor
        v-if="marking?.imageUrl"
        :image-url="marking.imageUrl" :rooms="marking.explication" :zones="marking.roomZones"
        @update:zones="onRoomZones(marking!.id, $event)"
      />
      <p class="mt-3 flex items-start gap-1.5 text-[11.5px] text-muted">
        <Icon name="ph:info" size="13" class="mt-0.5 shrink-0" />
        Разметка общая для всех помещений этой планировки — обводить контуры нужно один раз.
        У помещения со своим файлом планировки разметка своя.
      </p>
    </AppModal>

    <AppModal :model-value="!!confirmRemove" title="Удалить планировку?" width="sm" @update:model-value="confirmRemove = null">
      <p class="text-[13px] text-muted">
        Планировка «{{ confirmRemove?.name }}» будет удалена, а привязка {{ confirmRemove ? linkedCount(confirmRemove) : 0 }} помещений — снята. Сами помещения и их статусы останутся.
      </p>
      <div class="mt-4 flex gap-2">
        <AppButton block @click="confirmRemove = null">Отмена</AppButton>
        <AppButton block variant="danger" icon="ph:trash" @click="doRemove">Удалить</AppButton>
      </div>
    </AppModal>

    <PresetUnitPicker v-model="pickerOpen" :building="building" :preset="pickerPreset" />
  </div>
</template>

