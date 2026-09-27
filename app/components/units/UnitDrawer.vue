<script setup lang="ts">
import type { ExplicationRoom, ReservationKind, UnitStatus } from '~/types/models'
import { UNIT_KIND_META, UNIT_STATUS_META, RESERVATION_KIND_META, UNIT_BOARD_COLOR } from '~/utils/meta'
import { area as fmtArea, fmtDate, fmtPhone, money } from '~/utils/format'
import { fileToObjectUrl, pickFiles } from '~/composables/useFileUpload'
import { explicationTotals, roomColor, roomLabel } from '~/utils/explication'
import { zoneCentroid, zonePointsAttr } from '~/utils/zones'
import type { ZoneOption } from '~/components/units/ImageZoneEditor.vue'

const props = defineProps<{ unitId: string | null }>()
const emit = defineEmits<{ close: []; navigate: [string] }>()

const unitsStore = useUnitsStore()
const salesStore = useSalesStore()
const settingsStore = useSettingsStore()
const misc = useMiscStore()
const auth = useAuthStore()
const ui = useUiStore()

const open = computed({ get: () => !!props.unitId, set: (v) => { if (!v) emit('close') } })
const unit = computed(() => (props.unitId ? unitsStore.unit(props.unitId) : undefined))
const project = computed(() => (unit.value ? unitsStore.project(unit.value.projectId) : undefined))
const building = computed(() => (unit.value ? unitsStore.building(unit.value.buildingId) : undefined))
const reservation = computed(() => (unit.value ? salesStore.reservationForUnit(unit.value.id) : undefined))
const client = computed(() => (reservation.value ? salesStore.client(reservation.value.clientId) : undefined))
const preset = computed(() => (unit.value?.layoutPresetId ? building.value?.unitTypePresets.find((p) => p.id === unit.value!.layoutPresetId) : undefined))
const displayImage = computed(() => unit.value?.imageUrl || preset.value?.imageUrl || null)

/* --------------------------- разметка комнат ------------------------------ */

// изображение и разметка всегда идут парой: свой файл — своя разметка,
// иначе показываем разметку планировки-типа
const roomPlan = computed(() => (props.unitId ? unitsStore.roomPlanFor(props.unitId) : null))
const roomMarking = ref(false)

function openRoomMarking() {
  if (!roomPlan.value) { ui.toast('Сначала загрузите планировку помещения', 'warn'); return }
  if (!roomPlan.value.own) {
    ui.toast('Разметка берётся из планировки — правьте её в карточке дома', 'info')
    return
  }
  if (!explication.value.rooms.length) { ui.toast('Сначала заполните экспликацию', 'warn'); return }
  roomMarking.value = true
}
function onRoomZones(zones: import('~/types/models').ImageZone[]) {
  if (unit.value) unitsStore.setUnitRoomZones(unit.value.id, zones)
}
/** Комната под областью — для подписей поверх превью. */
function zoneRoom(refId: string) {
  return explication.value.rooms.find((r) => r.id === refId)
}
const { can } = useAccess()
const canEdit = computed(() => can('unit.editStatus')
  && unit.value?.status !== 'sold' && unit.value?.status !== 'installment')
/** Цена — прайс, а не карточка: менеджер её видит, но не правит. */
const canPrice = computed(() => canEdit.value && can('unit.editPrice'))

type UnitTab = 'params' | 'deal' | 'explication' | 'plan' | 'history'
const tab = ref<UnitTab>('params')
// у занятого помещения первым делом смотрят сделку, у свободного — параметры
watch(() => props.unitId, () => {
  tab.value = unit.value?.contractId || reservation.value ? 'deal' : 'params'
})

const priceChanges = computed(() => (props.unitId
  ? unitsStore.historyFor(props.unitId).filter((h) => h.kind === 'price').length
  : 0))

const tabs = computed(() => [
  { value: 'params', label: 'Параметры', icon: 'ph:sliders-horizontal' },
  { value: 'deal', label: 'Сделка', icon: 'ph:handshake' },
  { value: 'explication', label: 'Экспликация', icon: 'ph:list-numbers', count: explication.value.rooms.length || undefined },
  { value: 'plan', label: 'На плане', icon: 'ph:polygon' },
  { value: 'history', label: 'История цены', icon: 'ph:chart-line-up', count: priceChanges.value || undefined },
])

const finishingOptions = [
  { value: 'none', label: 'Без отделки' }, { value: 'rough', label: 'Черновая' },
  { value: 'fine', label: 'Чистовая' }, { value: 'furnished', label: 'Меблировано' },
]

async function uploadPlan() {
  if (!unit.value) return
  const [file] = await pickFiles('image/*')
  if (!file) return
  unitsStore.patchUnit(unit.value.id, { imageUrl: fileToObjectUrl(file) })
  ui.toast('Планировка помещения загружена', 'ok')
}
function removePlan() {
  if (!unit.value) return
  unitsStore.patchUnit(unit.value.id, { imageUrl: undefined })
}

function patchField(field: 'number' | 'rooms' | 'area' | 'price' | 'finishing', raw: string) {
  if (!unit.value) return
  if (field === 'number' || field === 'finishing') {
    unitsStore.patchUnit(unit.value.id, { [field]: raw })
    return
  }
  const n = Number(raw)
  if (Number.isFinite(n) && n >= 0) unitsStore.patchUnit(unit.value.id, { [field]: n, ...(field === 'price' ? { basePrice: n } : {}) })
}

/* ------------------------------- экспликация ------------------------------- */

const explication = computed(() => (unit.value ? unitsStore.explicationFor(unit.value.id) : { rooms: [], own: false }))
const explicationTotal = computed(() => explicationTotals(explication.value.rooms))

function onExplicationUpdate(rooms: ExplicationRoom[]) {
  // первая же правка унаследованной ведомости делает её собственной —
  // иначе правка одной квартиры молча изменила бы все остальные с этой
  // планировкой; store копирует строки и переименовывает их под помещение
  if (unit.value) unitsStore.setUnitExplication(unit.value.id, rooms)
}
function fillExplicationTemplate() {
  if (!unit.value) return
  unitsStore.fillUnitExplicationFromTemplate(unit.value.id)
  ui.toast('Экспликация собрана под площадь помещения', 'ok')
}
function resetExplication() {
  if (!unit.value) return
  unitsStore.resetUnitExplication(unit.value.id)
  ui.toast('Вернули экспликацию планировки', 'info')
}
function applyExplicationArea(value: number) {
  if (!unit.value) return
  unitsStore.patchUnit(unit.value.id, { area: value })
  ui.toast(`Площадь помещения — ${value} м²`, 'ok')
}

/* ----------------------------- место на плане ------------------------------ */

const floorPlan = computed(() => (unit.value ? building.value?.floorPlans.find((f) => f.floor === unit.value!.floor) : undefined))
const planZones = computed(() => floorPlan.value?.zones ?? [])
const isMarked = computed(() => planZones.value.some((z) => z.refId === unit.value?.id))

const planOptions = computed<ZoneOption[]>(() => {
  const u = unit.value
  if (!u) return []
  return unitsStore.units
    .filter((x) => x.buildingId === u.buildingId && x.floor === u.floor)
    .map((x) => ({
      value: x.id,
      label: `№ ${x.number}`,
      // текущее помещение подсвечиваем брендовым цветом, соседние — по статусу
      color: x.id === u.id ? 'var(--fill-plum)' : UNIT_BOARD_COLOR[x.status],
      hint: `${x.rooms || '—'} комн. · ${x.area} м² · ${UNIT_STATUS_META[x.status].label}`,
    }))
})

function onPlanPick(refId: string) {
  if (refId !== unit.value?.id) emit('navigate', refId)
}

/* --------------------------------- продажи --------------------------------- */

const showReserveForm = ref(false)
const reserveForm = reactive({ kind: 'with_deposit' as ReservationKind, name: '', phone: '' })

function daysLeft(iso: string) {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000))
}

async function submitReserve() {
  if (!unit.value || !reserveForm.name.trim() || !reserveForm.phone.trim()) {
    ui.toast('Укажите имя и телефон клиента', 'warn')
    return
  }
  let c = salesStore.clients.find((x) => x.phone === reserveForm.phone.replace(/\D/g, ''))
  if (!c) c = await salesStore.addClient({ kind: 'person', name: reserveForm.name, phone: reserveForm.phone.replace(/\D/g, ''), origin: 'own' })
  const deposit = reserveForm.kind === 'with_deposit' ? settingsStore.reservationSettings.minDeposit : 0
  await salesStore.reserveUnit(unit.value.id, c.id, reserveForm.kind, deposit, auth.user?.id ?? '')
  misc.log('Продажи', `Создана бронь на ${uname(unit.value)} — ${reserveForm.kind === 'no_deposit' ? '1 день' : reserveForm.kind === 'confirmed' ? '3 дня' : '30 дней'}`, auth.user?.name ?? '')
  ui.toast('Объект забронирован', 'ok')
  showReserveForm.value = false
  reserveForm.name = ''
  reserveForm.phone = ''
}

async function releaseReservation() {
  if (!reservation.value) return
  await salesStore.cancelReservation(reservation.value.id)
  misc.log('Продажи', `Бронь снята: ${unit.value ? uname(unit.value) : ''}`, auth.user?.name ?? '')
  ui.toast('Бронь снята', 'info')
}

function uname(u: NonNullable<typeof unit.value>) {
  return `№ ${u.number}`
}

/** Снять с продажи и вернуть обратно — самая частая правка на шахматке. */
function setStatus(status: UnitStatus) {
  if (!unit.value || unit.value.status === status || unit.value.status === 'reserved') return
  unitsStore.setStatus(unit.value.id, status, auth.user?.name ?? 'Система')
  misc.log('Шахматка', `№ ${unit.value.number}: статус «${UNIT_STATUS_META[status].label}»`, auth.user?.name ?? '')
  ui.toast(`Статус: ${UNIT_STATUS_META[status].label}`, 'ok')
}
</script>

<template>
  <AppDrawer v-model="open" :title="unit ? `№ ${unit.number}` : ''" :subtitle="project && building ? `${project.name} · ${building.name}` : ''" width="min(580px, 100vw)">
    <template v-if="unit">
      <div class="flex flex-wrap items-center gap-2">
        <StatusTag :tone="UNIT_STATUS_META[unit.status].tone" dot>{{ UNIT_STATUS_META[unit.status].label }}</StatusTag>
        <StatusTag tone="neutral" :icon="UNIT_KIND_META[unit.kind].icon">{{ UNIT_KIND_META[unit.kind].label }}</StatusTag>
        <StatusTag v-if="unit.keysIssued" tone="ok" icon="ph:key">Ключи выданы</StatusTag>
        <span class="ml-auto tabular text-[13px] font-semibold text-ink">{{ money(unit.price, project?.currency) }}</span>
      </div>

      <!-- планировка помещения -->
      <div class="group relative mt-3.5 aspect-[4/3] overflow-hidden rounded-xl2 border border-line bg-soft">
        <template v-if="displayImage">
          <img :src="displayImage" class="h-full w-full object-contain" :alt="`Планировка №${unit.number}`">
          <!-- контуры комнат поверх плана: наведение даёт название и площадь -->
          <svg v-if="roomPlan?.zones.length" class="absolute inset-0 h-full w-full" viewBox="0 0 1 1" preserveAspectRatio="none">
            <polygon
              v-for="z in roomPlan.zones" :key="z.id" :points="zonePointsAttr(z)"
              vector-effect="non-scaling-stroke"
              :style="{ fill: zoneRoom(z.refId) ? roomColor(zoneRoom(z.refId)!.kind) : z.color, fillOpacity: 0.26, stroke: zoneRoom(z.refId) ? roomColor(zoneRoom(z.refId)!.kind) : z.color, strokeWidth: 1.2 }"
            >
              <title>{{ zoneRoom(z.refId) ? `${roomLabel(zoneRoom(z.refId)!)} · ${zoneRoom(z.refId)!.area} м²` : z.label }}</title>
            </polygon>
          </svg>
          <span
            v-for="z in (roomPlan?.zones ?? [])" :key="`rl-${z.id}`"
            class="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded px-1 py-px text-[9.5px] font-bold text-white"
            :style="{ left: `${zoneCentroid(z).x * 100}%`, top: `${zoneCentroid(z).y * 100}%`, background: zoneRoom(z.refId) ? roomColor(zoneRoom(z.refId)!.kind) : z.color }"
          >{{ zoneRoom(z.refId) ? roomLabel(zoneRoom(z.refId)!) : z.label }}</span>
        </template>
        <button v-else type="button" class="flex h-full w-full flex-col items-center justify-center gap-2 text-muted transition-colors hover:bg-plum-soft hover:text-plum" @click="uploadPlan">
          <Icon name="ph:floor-plan" size="26" />
          <span class="text-[12.5px] font-semibold">Загрузить планировку помещения</span>
        </button>
        <div v-if="displayImage" class="absolute right-2 top-2 flex gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
          <button class="grid h-8 w-8 place-items-center rounded-lg bg-ink/65 text-white" :title="unit.imageUrl ? 'Заменить файл' : 'Загрузить свой файл'" @click="uploadPlan"><Icon name="ph:arrow-clockwise" size="15" /></button>
          <button v-if="unit.imageUrl" class="grid h-8 w-8 place-items-center rounded-lg bg-ink/65 text-white" title="Убрать свой файл" @click="removePlan"><Icon name="ph:trash" size="15" /></button>
        </div>
        <span v-if="!unit.imageUrl && preset?.imageUrl" class="absolute bottom-2 left-2 rounded-full bg-ink/65 px-2 py-1 text-[11px] font-medium text-white">из планировки «{{ preset.name }}»</span>
      </div>

      <Tabs :model-value="tab" class="mt-4" :tabs="tabs" @update:model-value="tab = $event as UnitTab" />

      <!-- параметры -->
      <div v-if="tab === 'params'" class="pt-4">
        <div class="grid grid-cols-2 gap-3 rounded-xl2 border border-line bg-panel p-3.5">
          <label class="flex flex-col gap-1 text-[11px] font-medium uppercase tracking-[0.03em] text-muted">
            Номер
            <input :value="unit.number" :disabled="!canEdit" class="focus-ring rounded-lg border border-line bg-panel px-2.5 py-1.5 text-[14px] font-semibold text-ink disabled:opacity-60" @change="patchField('number', ($event.target as HTMLInputElement).value)">
          </label>
          <label class="flex flex-col gap-1 text-[11px] font-medium uppercase tracking-[0.03em] text-muted">
            Комнат
            <input type="number" :value="unit.rooms" :disabled="!canEdit" class="focus-ring tabular rounded-lg border border-line bg-panel px-2.5 py-1.5 text-[14px] text-ink disabled:opacity-60" @change="patchField('rooms', ($event.target as HTMLInputElement).value)">
          </label>
          <label class="flex flex-col gap-1 text-[11px] font-medium uppercase tracking-[0.03em] text-muted">
            Площадь, м²
            <input type="number" step="0.1" :value="unit.area" :disabled="!canEdit" class="focus-ring tabular rounded-lg border border-line bg-panel px-2.5 py-1.5 text-[14px] text-ink disabled:opacity-60" @change="patchField('area', ($event.target as HTMLInputElement).value)">
          </label>
          <label class="flex flex-col gap-1 text-[11px] font-medium uppercase tracking-[0.03em] text-muted">
            Цена, {{ project?.currency }}
            <input type="number" :value="unit.price" :disabled="!canPrice" class="focus-ring tabular rounded-lg border border-line bg-panel px-2.5 py-1.5 text-[14px] font-semibold text-ink disabled:opacity-60" @change="patchField('price', ($event.target as HTMLInputElement).value)">
          </label>
          <label class="col-span-2 flex flex-col gap-1 text-[11px] font-medium uppercase tracking-[0.03em] text-muted">
            Отделка
            <select :value="unit.finishing" :disabled="!canEdit" class="focus-ring rounded-lg border border-line bg-panel px-2.5 py-1.5 text-[14px] text-ink disabled:opacity-60" @change="patchField('finishing', ($event.target as HTMLSelectElement).value)">
              <option v-for="o in finishingOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
            </select>
          </label>
        </div>

        <dl class="mt-3 grid grid-cols-2 gap-x-5">
          <div v-for="row in [
            ['Секция / этаж', `${unit.section || '—'} / ${unit.floor}`],
            ['Цена за м²', money(Math.round(unit.price / (unit.area || 1)), project?.currency)],
            ['Планировка', preset?.name ?? 'не привязана'],
            ['По экспликации', explication.rooms.length ? fmtArea(explicationTotal.total) : '—'],
          ]" :key="row[0]" class="flex items-baseline justify-between gap-2 border-b border-line py-2"
          >
            <dt class="text-[12px] text-muted">{{ row[0] }}</dt>
            <dd class="text-right text-[13px] font-medium text-ink">{{ row[1] }}</dd>
          </div>
        </dl>
        <p v-if="!canEdit" class="mt-2.5 flex items-center gap-1.5 text-[11.5px] text-muted"><Icon name="ph:lock-simple" size="13" /> Проданные помещения не редактируются — правки через договор</p>
      </div>

      <!-- сделка: клиент, договор, деньги и график без ухода со страницы -->
      <div v-else-if="tab === 'deal'" class="pt-4">
        <UnitDealCard :unit="unit" />
      </div>

      <!-- история цены -->
      <div v-else-if="tab === 'history'" class="pt-4">
        <UnitPriceHistory :unit="unit" />
      </div>

      <!-- экспликация -->
      <div v-else-if="tab === 'explication'" class="pt-4">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
          <StatusTag :tone="explication.own ? 'plum' : 'neutral'" size="sm" :icon="explication.own ? 'ph:pencil-simple' : 'ph:link'">
            {{ explication.own ? 'Своя экспликация' : explication.presetName ? `Из планировки «${explication.presetName}»` : 'Не заполнена' }}
          </StatusTag>
          <button v-if="explication.own && explication.presetName" class="text-[11.5px] font-medium text-muted hover:text-plum" @click="resetExplication">
            Вернуть из планировки
          </button>
        </div>
        <ExplicationEditor
          :rooms="explication.rooms" :declared-area="unit.area" :readonly="!canEdit"
          @update:rooms="onExplicationUpdate" @template="fillExplicationTemplate" @apply-area="applyExplicationArea"
        />
        <!-- разметка комнат на планировке -->
        <div v-if="roomPlan" class="mt-3.5 flex flex-wrap items-center justify-between gap-2 rounded-xl2 border border-line bg-soft px-3 py-2.5">
          <div class="min-w-0 text-[12.5px]">
            <p class="font-semibold text-ink">Комнаты на планировке</p>
            <p class="text-muted">
              {{ roomPlan.zones.length ? `Размечено ${roomPlan.zones.length} из ${explication.rooms.length}` : 'Не размечено' }}
              <template v-if="!roomPlan.own"> · разметка из планировки «{{ roomPlan.presetName }}»</template>
            </p>
          </div>
          <AppButton v-if="roomPlan.own" size="sm" variant="primary" icon="ph:polygon" @click="openRoomMarking">Разметить</AppButton>
          <AppButton
            v-else-if="roomPlan.presetId" size="sm" icon="ph:arrow-up-right"
            @click="navigateTo(`/buildings/${unit!.buildingId}?tab=presets`)"
          >К планировке</AppButton>
        </div>

        <p v-if="!explication.own && explication.rooms.length" class="mt-2.5 flex items-start gap-1.5 text-[11.5px] text-muted">
          <Icon name="ph:info" size="13" class="mt-0.5 shrink-0" />
          Любая правка создаст отдельную экспликацию для этого помещения — остальные квартиры планировки не изменятся.
        </p>
      </div>

      <!-- расположение на плане этажа -->
      <div v-else class="pt-4">
        <template v-if="floorPlan?.imageUrl && planZones.length">
          <p class="mb-2 flex items-start gap-1.5 text-[12px] text-muted">
            <Icon name="ph:cursor-click" size="14" class="mt-0.5 shrink-0" />
            <span v-if="isMarked">Помещение выделено на плане {{ unit.floor }} этажа. Клик по соседней области откроет её карточку.</span>
            <span v-else>Это помещение ещё не размечено на плане {{ unit.floor }} этажа.</span>
          </p>
          <ImageZoneEditor
            readonly :image-url="floorPlan.imageUrl" :zones="planZones" :options="planOptions" @pick="onPlanPick"
          />
        </template>
        <EmptyState
          v-else compact icon="ph:polygon"
          :title="floorPlan?.imageUrl ? 'Этаж не размечен' : 'План этажа не загружен'"
          text="Разметка помещений делается в карточке дома, раздел «Планировки этажей»"
        >
          <template #action>
            <AppButton size="sm" icon="ph:arrow-right" @click="navigateTo(`/buildings/${unit!.buildingId}?tab=floorplans`)">Перейти к планам этажей</AppButton>
          </template>
        </EmptyState>
      </div>

      <div class="my-4 border-t border-line" />

      <!-- быстрая смена статуса: снять с продажи и вернуть обратно -->
      <div v-if="!unit.contractId" class="mb-3 flex flex-wrap items-center gap-2">
        <span class="text-[11px] font-semibold uppercase tracking-[0.04em] text-muted">Статус</span>
        <Chip
          v-for="st in (['free', 'closed'] as const)" :key="st" :pressed="unit.status === st"
          :disabled="unit.status === 'reserved'"
          @click="setStatus(st)"
        >{{ UNIT_STATUS_META[st].label }}</Chip>
        <span v-if="unit.status === 'reserved'" class="text-[11.5px] text-muted">снимите бронь, чтобы менять статус</span>
      </div>

      <!-- свободно -->
      <div v-if="unit.status === 'free'">
        <AppButton v-if="!showReserveForm" variant="primary" icon="ph:bookmark-simple" block @click="showReserveForm = true">Забронировать</AppButton>
        <div v-else class="flex flex-col gap-3 rounded-xl2 border border-line p-3.5">
          <p class="text-[12.5px] font-semibold">Новая бронь</p>
          <div class="flex flex-col gap-1.5">
            <span class="text-[12.5px] font-medium text-muted">Вид брони</span>
            <div class="flex flex-col gap-1.5">
              <label v-for="(meta, key) in RESERVATION_KIND_META" :key="key" class="flex cursor-pointer items-center gap-2 rounded-xl2 border border-line px-3 py-2 text-[13px] has-[:checked]:border-plum has-[:checked]:bg-plum-soft">
                <input v-model="reserveForm.kind" type="radio" :value="key" class="accent-plum">
                {{ meta.label }} <span class="text-muted">— {{ meta.days }} {{ meta.days === 1 ? 'день' : meta.days < 5 ? 'дня' : 'дней' }}</span>
              </label>
            </div>
          </div>
          <AppInput v-model="reserveForm.name" label="Клиент" placeholder="Имя Фамилия" />
          <AppInput v-model="reserveForm.phone" label="Телефон" placeholder="+996 700 000 000" />
          <div class="flex gap-2">
            <AppButton variant="ghost" @click="showReserveForm = false">Отмена</AppButton>
            <AppButton variant="primary" block @click="submitReserve">Создать бронь</AppButton>
          </div>
        </div>
      </div>

      <!-- в брони -->
      <div v-else-if="unit.status === 'reserved' && reservation" class="flex flex-col gap-3">
        <div class="rounded-xl2 border border-reserve bg-reserve-bg p-3.5">
          <p class="flex items-center justify-between text-[13px] font-semibold text-warn">
            <span>Бронь · {{ RESERVATION_KIND_META[reservation.kind].label }}</span>
            <span>{{ daysLeft(reservation.expiresAt) }} дн.</span>
          </p>
          <p class="mt-1.5 text-[13px]">{{ client?.name }}</p>
          <p class="text-[12px] text-muted">{{ fmtPhone(client?.phone ?? '') }} · до {{ fmtDate(reservation.expiresAt) }}</p>
          <p v-if="reservation.deposit" class="mt-1 text-[12px] text-muted">Задаток: {{ money(reservation.deposit, 'KGS') }}</p>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <AppButton variant="danger" icon="ph:x-circle" @click="releaseReservation">Снять бронь</AppButton>
          <AppButton variant="primary" icon="ph:file-text" @click="navigateTo(`/deals/new?unit=${unit.id}`)">В договор</AppButton>
        </div>

        <UnitQueueCard :unit="unit" />
      </div>

      <!-- в рассрочке / продано -->
      <div v-else-if="unit.contractId" class="flex flex-col gap-3">
        <AppButton variant="primary" icon="ph:file-text" block @click="navigateTo(`/contracts/${unit.contractId}`)">Открыть договор</AppButton>
        <UnitQueueCard :unit="unit" />
      </div>

      <div v-else-if="unit.status === 'closed'">
        <p class="rounded-xl2 bg-soft px-3.5 py-3 text-[12.5px] text-muted">Объект закрыт для продаж.</p>
      </div>
    </template>

    <AppModal
      :model-value="roomMarking" width="xl"
      :title="`Разметка комнат — № ${unit?.number ?? ''}`"
      @update:model-value="roomMarking = false"
    >
      <RoomPlanEditor
        v-if="roomPlan?.own && roomPlan.imageUrl"
        :image-url="roomPlan.imageUrl" :rooms="explication.rooms" :zones="roomPlan.zones"
        @update:zones="onRoomZones"
      />
    </AppModal>
  </AppDrawer>
</template>
