<script setup lang="ts">
import type { MatchedUnit } from '~/composables/useLeadMatching'
import { UNIT_KIND_META, UNIT_STATUS_META, RESERVATION_KIND_META } from '~/utils/meta'
import { area as fmtArea, fmtDate, fmtPhone, money } from '~/utils/format'
import { bestPromoForUnit } from '~/utils/board'

/**
 * Мини-карточка помещения: всё, что нужно менеджеру, чтобы ответить клиенту,
 * не открывая дровер. Показывает и сделку — цену, оплаченное, остаток и
 * ближайший платёж: «посмотреть договор» больше не повод уходить со страницы.
 */
const props = defineProps<{
  unitId: string
  /** координаты клика во вьюпорте — карточка встаёт рядом и не уезжает за край */
  x: number
  y: number
  score?: MatchedUnit
  /** в контексте заявки — кнопка «в подборку клиента» */
  leadId?: string
  linked?: boolean
  selected?: boolean
}>()
const emit = defineEmits<{
  close: []
  reserve: [string]
  contract: [string]
  open: [string]
  toggleSelect: [string]
  link: [string]
}>()

const unitsStore = useUnitsStore()
const salesStore = useSalesStore()
const dealsStore = useDealsStore()
const settingsStore = useSettingsStore()

const unit = computed(() => unitsStore.unit(props.unitId))
const building = computed(() => (unit.value ? unitsStore.building(unit.value.buildingId) : undefined))
const preset = computed(() => (unit.value?.layoutPresetId
  ? building.value?.unitTypePresets.find((p) => p.id === unit.value!.layoutPresetId)
  : undefined))
const thumb = computed(() => unit.value?.imageUrl || preset.value?.imageUrl || null)

const reservation = computed(() => (unit.value ? salesStore.reservationForUnit(unit.value.id) : undefined))
const contract = computed(() => (unit.value?.contractId ? dealsStore.contract(unit.value.contractId) : undefined))
const balance = computed(() => (contract.value ? dealsStore.balance(contract.value.id) : null))
const client = computed(() => {
  const id = contract.value?.clientId ?? reservation.value?.clientId
  return id ? salesStore.client(id) : undefined
})
const queue = computed(() => (unit.value ? unitsStore.queueFor(unit.value.id) : []))
const promo = computed(() => (unit.value ? bestPromoForUnit(unit.value, settingsStore.promotions) : null))
const perM2 = computed(() => (unit.value?.area ? Math.round(unit.value.price / unit.value.area) : 0))
const paidPct = computed(() => (balance.value && balance.value.price
  ? Math.round((balance.value.paid / balance.value.price) * 100)
  : 0))

const daysLeft = computed(() => (reservation.value
  ? Math.max(0, Math.ceil((new Date(reservation.value.expiresAt).getTime() - Date.now()) / 86400000))
  : 0))

/* ------------------------------ расположение ------------------------------ */

const W = 316
const H = 420

const style = computed(() => {
  const pad = 14
  const vw = import.meta.client ? window.innerWidth : 1440
  const vh = import.meta.client ? window.innerHeight : 900
  let left = props.x + 16
  let top = props.y - 40
  if (left + W + pad > vw) left = Math.max(pad, props.x - W - 16)
  if (top + H + pad > vh) top = Math.max(pad, vh - H - pad)
  if (top < pad) top = pad
  return { left: `${left}px`, top: `${top}px`, width: `${W}px` }
})

const cardRef = ref<HTMLElement | null>(null)
onClickOutside(cardRef, () => emit('close'))

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <Transition appear enter-active-class="animate-pop-in">
      <aside
        v-if="unit" ref="cardRef"
        class="fixed z-[75] overflow-hidden rounded-card border border-line bg-panel shadow-pop"
        :style="style"
      >
        <!-- планировка -->
        <div class="relative h-[124px] border-b border-line bg-soft">
          <img v-if="thumb" :src="thumb" class="h-full w-full object-contain" :alt="`Планировка № ${unit.number}`">
          <span v-else class="grid h-full w-full place-items-center text-muted"><Icon name="ph:floor-plan" size="26" /></span>
          <button
            class="focus-ring absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-lg bg-ink/60 text-white"
            title="Закрыть" @click="emit('close')"
          ><Icon name="ph:x" size="14" /></button>
          <span
            v-if="score" class="absolute left-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[10.5px] font-bold"
            :class="score.score >= 90 ? 'bg-fill-ok text-white' : 'bg-panel text-ink ring-1 ring-line'"
          >{{ score.score }}% совпадение</span>
        </div>

        <div class="p-3.5">
          <!-- шапка -->
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <p class="tabular text-[16px] font-semibold leading-none text-ink">№ {{ unit.number }}</p>
              <p class="mt-1 truncate text-[11.5px] text-muted">
                {{ building?.name }} · эт. {{ unit.floor }}{{ unit.section ? ` · секция ${unit.section}` : '' }}
              </p>
            </div>
            <StatusTag :tone="UNIT_STATUS_META[unit.status].tone" size="sm" dot>{{ UNIT_STATUS_META[unit.status].label }}</StatusTag>
          </div>

          <!-- параметры -->
          <div class="mt-2.5 grid grid-cols-3 gap-px overflow-hidden rounded-xl2 border border-line bg-line">
            <div class="bg-panel px-2 py-1.5 text-center">
              <p class="tabular text-[13px] font-semibold text-ink">{{ unit.rooms || '—' }}</p>
              <p class="text-[10px] text-muted">комнат</p>
            </div>
            <div class="bg-panel px-2 py-1.5 text-center">
              <p class="tabular text-[13px] font-semibold text-ink">{{ unit.area }}</p>
              <p class="text-[10px] text-muted">м²</p>
            </div>
            <div class="bg-panel px-2 py-1.5 text-center">
              <p class="tabular text-[13px] font-semibold text-ink">{{ UNIT_KIND_META[unit.kind].short }}</p>
              <p class="text-[10px] text-muted">тип</p>
            </div>
          </div>

          <!-- цена -->
          <div class="mt-2.5 flex items-end justify-between gap-2">
            <div>
              <p class="tabular text-[19px] font-semibold leading-none tracking-[-0.02em] text-ink">{{ money(unit.price) }}</p>
              <p class="tabular mt-1 text-[11.5px] text-muted">{{ money(perM2) }}/м² · {{ fmtArea(unit.area) }}</p>
            </div>
            <span v-if="promo" class="rounded-full bg-bad-bg px-2 py-0.5 text-[11px] font-bold text-bad" :title="promo.name">
              −{{ promo.value }}%
            </span>
          </div>

          <!-- сделка: то, за чем раньше уходили в договор -->
          <div v-if="contract && balance" class="mt-2.5 rounded-xl2 border border-line bg-soft/60 p-2.5">
            <div class="flex items-center justify-between gap-2">
              <p class="truncate text-[12px] font-semibold text-ink">{{ client?.name ?? 'Клиент' }}</p>
              <NuxtLink :to="`/contracts/${contract.id}`" class="tabular shrink-0 text-[11.5px] font-semibold text-plum hover:underline">
                {{ contract.number }}
              </NuxtLink>
            </div>
            <div class="mt-1.5 flex items-center gap-2">
              <div class="h-[5px] flex-1 overflow-hidden rounded-full bg-line">
                <span class="block h-full rounded-full bg-fill-ok" :style="{ width: `${paidPct}%` }" />
              </div>
              <span class="tabular shrink-0 text-[11px] font-semibold text-ink">{{ paidPct }}%</span>
            </div>
            <dl class="mt-1.5 flex flex-col gap-0.5 text-[11.5px]">
              <div class="flex justify-between"><dt class="text-muted">Оплачено</dt><dd class="tabular font-medium">{{ money(balance.paid) }}</dd></div>
              <div class="flex justify-between"><dt class="text-muted">Остаток</dt><dd class="tabular font-medium">{{ money(balance.remaining) }}</dd></div>
              <div v-if="balance.overdueAmount" class="flex justify-between text-bad">
                <dt>Просрочка {{ balance.overdueDays }} дн.</dt><dd class="tabular font-semibold">{{ money(balance.overdueAmount) }}</dd>
              </div>
              <div v-else-if="balance.nextDue" class="flex justify-between">
                <dt class="text-muted">Платёж {{ fmtDate(balance.nextDue.dueDate) }}</dt>
                <dd class="tabular font-medium">{{ money(balance.nextDue.amount - balance.nextDue.paid) }}</dd>
              </div>
            </dl>
          </div>

          <!-- бронь -->
          <div v-else-if="reservation" class="mt-2.5 rounded-xl2 border border-reserve bg-reserve-bg p-2.5">
            <p class="flex items-center justify-between text-[12px] font-semibold text-warn">
              <span class="truncate">{{ client?.name ?? 'Клиент' }}</span>
              <span class="tabular shrink-0">{{ daysLeft }} дн.</span>
            </p>
            <p class="mt-0.5 truncate text-[11px] text-muted">
              {{ RESERVATION_KIND_META[reservation.kind].label }} · до {{ fmtDate(reservation.expiresAt) }}
              <template v-if="client?.phone"> · {{ fmtPhone(client.phone) }}</template>
            </p>
          </div>

          <!-- очередь -->
          <p v-if="queue.length" class="mt-2 flex items-center gap-1.5 rounded-lg bg-warn-bg px-2 py-1 text-[11.5px] font-medium text-warn">
            <Icon name="ph:users-three" size="13" /> В очереди {{ queue.length }} — первый {{ queue[0]?.name }}
          </p>

          <!-- разбор совпадения -->
          <div v-if="score" class="mt-2 flex flex-wrap gap-1">
            <span
              v-for="f in score.factors.filter((x) => !x.ok)" :key="f.key"
              class="rounded bg-warn-bg px-1.5 py-0.5 text-[10.5px] font-medium text-warn"
            >{{ f.label.toLowerCase() }} −{{ f.penalty }}</span>
            <span v-if="score.factors.every((f) => f.ok)" class="rounded bg-ok-bg px-1.5 py-0.5 text-[10.5px] font-medium text-ok">
              всё по запросу клиента
            </span>
          </div>

          <!-- действия -->
          <div class="mt-3 flex flex-wrap gap-1.5">
            <AppButton
              v-if="leadId" size="sm" :icon="linked ? 'ph:minus-bold' : 'ph:plus-bold'"
              @click="emit('link', unit.id)"
            >{{ linked ? 'Из подборки' : 'В подборку' }}</AppButton>
            <AppButton
              size="sm" variant="primary" icon="ph:bookmark-simple" :disabled="unit.status !== 'free'"
              @click="emit('reserve', unit.id)"
            >Бронь</AppButton>
            <AppButton size="sm" icon="ph:file-text" :disabled="unit.status === 'sold' || unit.status === 'installment'" @click="emit('contract', unit.id)">
              Договор
            </AppButton>
            <button
              type="button"
              class="focus-ring grid h-8 w-8 place-items-center rounded-xl2 border transition-colors"
              :class="selected ? 'border-ink bg-ink text-panel' : 'border-line text-muted hover:text-ink'"
              title="Добавить к сравнению" @click="emit('toggleSelect', unit.id)"
            ><Icon name="ph:arrows-left-right" size="14" /></button>
            <AppButton size="sm" icon="ph:arrow-square-out" @click="emit('open', unit.id)">Карточка</AppButton>
          </div>
        </div>
      </aside>
    </Transition>
  </Teleport>
</template>
