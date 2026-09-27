<script setup lang="ts">
import { fmtDate, money, moneyCompact } from '~/utils/format'

/**
 * Карточка дома на генплане. Клик по дому больше не уносит менеджера на фасад
 * вслепую: сначала он видит остаток, среднюю цену и объём фонда — и уже сам
 * решает, идти на фасад, в шахматку или в карточку дома.
 */
const props = defineProps<{
  buildingId: string
  /** координаты клика во вьюпорте — карточка встаёт рядом и не уезжает за край */
  x: number
  y: number
}>()
const emit = defineEmits<{ close: []; facade: [string]; board: [string] }>()

const unitsStore = useUnitsStore()

const building = computed(() => unitsStore.building(props.buildingId))
const stats = computed(() => unitsStore.buildingStats(props.buildingId))

const stageLabel: Record<string, string> = {
  planning: 'Проектирование', foundation: 'Котлован', frame: 'Каркас', facade: 'Фасад', finishing: 'Отделка', commissioned: 'Сдан',
}

const cover = computed(() => {
  const facades = building.value?.facades.filter((f) => f.imageUrl) ?? []
  return (facades.find((f) => f.published) ?? facades[0])?.imageUrl ?? null
})

const hasFacade = computed(() => Boolean(cover.value))

/* ------------------------------ расположение ------------------------------ */

const W = 300
const H = 344

const style = computed(() => {
  const pad = 14
  const vw = import.meta.client ? window.innerWidth : 1440
  const vh = import.meta.client ? window.innerHeight : 900
  let left = props.x + 16
  let top = props.y - 32
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
        v-if="building" ref="cardRef"
        class="fixed z-[75] overflow-hidden rounded-card border border-line bg-panel shadow-pop"
        :style="style"
      >
        <div class="relative h-[104px] border-b border-line bg-soft">
          <img v-if="cover" :src="cover" class="h-full w-full object-cover" :alt="building.name">
          <span v-else class="grid h-full w-full place-items-center text-muted"><Icon name="ph:building-apartment" size="26" /></span>
          <button
            class="focus-ring absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-lg bg-ink/60 text-white"
            title="Закрыть" @click="emit('close')"
          ><Icon name="ph:x" size="14" /></button>
        </div>

        <div class="p-3.5">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <p class="truncate text-[15px] font-semibold leading-none text-ink">{{ building.name }}</p>
              <p class="mt-1 truncate text-[11.5px] text-muted">{{ building.floors }} эт. · {{ building.sections }} секц.</p>
              <p class="truncate text-[11.5px] text-muted">сдача {{ building.deliveryDate ? fmtDate(building.deliveryDate) : 'не указана' }}</p>
            </div>
            <StatusTag tone="neutral" size="sm">{{ stageLabel[building.constructionStage] ?? '—' }}</StatusTag>
          </div>

          <!-- остаток: первое, о чём спрашивают -->
          <div class="mt-2.5">
            <div class="flex items-baseline justify-between text-[12px]">
              <span class="text-muted">Свободно</span>
              <span class="tabular font-semibold text-ink">
                <b class="text-[15px] text-ok">{{ stats.freePct }}%</b>
                <span class="ml-1 text-[11.5px] text-muted">{{ stats.free }} из {{ stats.total }}</span>
              </span>
            </div>
            <div class="mt-1.5 flex h-[6px] overflow-hidden rounded-full bg-line">
              <span class="block h-full" :style="{ width: `${stats.soldPct}%`, background: 'var(--c-sold)' }" />
              <span
                class="block h-full"
                :style="{ width: `${stats.total ? Math.round((stats.reserved / stats.total) * 100) : 0}%`, background: 'var(--c-reserve)' }"
              />
              <span class="block h-full flex-1" :style="{ background: 'var(--c-free)' }" />
            </div>
            <p class="mt-1 flex flex-wrap gap-x-3 text-[11px] text-muted">
              <span>Продано {{ stats.sold }}</span>
              <span v-if="stats.reserved" class="text-warn">В брони {{ stats.reserved }}</span>
              <span>Реализация {{ stats.soldPct }}%</span>
            </p>
          </div>

          <dl class="mt-2.5 grid grid-cols-3 gap-px overflow-hidden rounded-xl2 border border-line bg-line">
            <div class="bg-panel px-2 py-1.5 text-center">
              <dd class="tabular text-[13px] font-semibold text-ink">{{ stats.apartments }}</dd>
              <dt class="text-[10px] text-muted">квартир</dt>
            </div>
            <div class="bg-panel px-2 py-1.5 text-center">
              <dd class="tabular text-[13px] font-semibold text-ink">{{ stats.avgPrice ? moneyCompact(stats.avgPrice) : '—' }}</dd>
              <dt class="text-[10px] text-muted">средняя</dt>
            </div>
            <div class="bg-panel px-2 py-1.5 text-center">
              <dd class="tabular text-[13px] font-semibold text-ink">{{ stats.avgPricePerM2 ? money(stats.avgPricePerM2) : '—' }}</dd>
              <dt class="text-[10px] text-muted">за м²</dt>
            </div>
          </dl>

          <p v-if="stats.minPrice" class="mt-2 flex items-baseline justify-between rounded-xl2 bg-soft px-2.5 py-1.5 text-[11.5px]">
            <span class="text-muted">Свободные квартиры от</span>
            <b class="tabular text-[13px] text-ink">{{ money(stats.minPrice) }}</b>
          </p>

          <div class="mt-3 flex flex-wrap gap-1.5">
            <AppButton
              size="sm" variant="primary" icon="ph:building-apartment" :disabled="!hasFacade"
              :title="hasFacade ? 'Открыть фасад дома' : 'У дома нет загруженного фасада'"
              @click="emit('facade', building.id)"
            >На фасад</AppButton>
            <AppButton size="sm" icon="ph:grid-nine" @click="emit('board', building.id)">Шахматка</AppButton>
            <AppButton
              size="sm" icon="ph:arrow-square-out" title="Открыть карточку дома"
              @click="navigateTo(`/buildings/${building.id}`)"
            />
          </div>
        </div>
      </aside>
    </Transition>
  </Teleport>
</template>
