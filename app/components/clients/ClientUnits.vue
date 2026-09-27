<script setup lang="ts">
import type { ClientProfile } from '~/utils/clientProfile'
import { UNIT_KIND_META, UNIT_STATUS_META } from '~/utils/meta'
import { area as fmtArea, fmtDate, money } from '~/utils/format'

/**
 * Что клиент купил. Карточками, а не строками: у помещения есть планировка,
 * и в разговоре «та самая двушка с эркером» узнаётся по картинке быстрее,
 * чем по номеру.
 */
const props = defineProps<{ profile: ClientProfile }>()
const emit = defineEmits<{ open: [string] }>()

const unitsStore = useUnitsStore()

interface UnitCardView {
  id: string
  number: string
  kindLabel: string
  kindIcon: string
  status: string
  statusTone: 'ok' | 'warn' | 'bad' | 'info' | 'neutral' | 'plum'
  project: string
  building: string
  floor: number
  section: number
  area: number
  price: number
  discount: number
  purchasedAt?: string
  thumb: string | null
  contractNumber?: string
  contractId?: string
}

const cards = computed<UnitCardView[]>(() => props.profile.units.map((u) => {
  const contract = props.profile.contracts.find((c) => c.unitIds.includes(u.id))
  const building = unitsStore.building(u.buildingId)
  const preset = u.layoutPresetId ? building?.unitTypePresets.find((p) => p.id === u.layoutPresetId) : undefined
  const base = contract?.discount ? Math.round(contract.price / (1 - contract.discount / 100)) : undefined
  return {
    id: u.id,
    number: u.number,
    kindLabel: UNIT_KIND_META[u.kind].label,
    kindIcon: UNIT_KIND_META[u.kind].icon,
    status: UNIT_STATUS_META[u.status].label,
    statusTone: UNIT_STATUS_META[u.status].tone,
    project: unitsStore.project(u.projectId)?.name ?? '—',
    building: building?.name ?? '—',
    floor: u.floor,
    section: u.section,
    area: u.area,
    price: contract?.price ?? u.price,
    discount: base ? base - (contract?.price ?? 0) : 0,
    purchasedAt: contract?.signedAt ?? contract?.createdAt,
    thumb: u.imageUrl || preset?.imageUrl || null,
    contractNumber: contract?.number,
    contractId: contract?.id,
  }
}).sort((a, b) => a.project.localeCompare(b.project) || a.number.localeCompare(b.number, undefined, { numeric: true })))

const totals = computed(() => ({
  count: cards.value.length,
  area: Math.round(cards.value.reduce((s, c) => s + c.area, 0) * 10) / 10,
  sum: cards.value.reduce((s, c) => s + c.price, 0),
}))
</script>

<template>
  <div class="flex flex-col gap-3">
    <div v-if="cards.length" class="flex flex-wrap items-center gap-x-5 gap-y-1 text-[12.5px] text-muted">
      <span>Объектов <b class="tabular text-ink">{{ totals.count }}</b></span>
      <span>Общая площадь <b class="tabular text-ink">{{ fmtArea(totals.area) }}</b></span>
      <span>Сумма покупок <b class="tabular text-ink">{{ money(totals.sum) }}</b></span>
    </div>

    <div v-if="cards.length" class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <article
        v-for="u in cards" :key="u.id"
        class="group overflow-hidden rounded-card border border-line bg-panel shadow-card transition-all hover:-translate-y-px hover:border-plum/40 hover:shadow-rise"
      >
        <button type="button" class="focus-ring block h-[132px] w-full border-b border-line bg-soft" title="Открыть карточку помещения" @click="emit('open', u.id)">
          <img v-if="u.thumb" :src="u.thumb" class="h-full w-full object-contain" :alt="`Планировка № ${u.number}`">
          <span v-else class="grid h-full w-full place-items-center text-muted"><Icon name="ph:floor-plan" size="26" /></span>
        </button>

        <div class="p-3">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <p class="tabular text-[15px] font-semibold leading-none text-ink">№ {{ u.number }}</p>
              <p class="mt-1 flex items-center gap-1 truncate text-[11.5px] text-muted">
                <Icon :name="u.kindIcon" size="12" class="shrink-0" /> {{ u.kindLabel }}
              </p>
            </div>
            <StatusTag :tone="u.statusTone" size="sm" dot>{{ u.status }}</StatusTag>
          </div>

          <dl class="mt-2.5 flex flex-col gap-0.5 text-[11.5px]">
            <div class="flex justify-between gap-2"><dt class="text-muted">ЖК</dt><dd class="truncate font-medium text-ink">{{ u.project }}</dd></div>
            <div class="flex justify-between gap-2"><dt class="text-muted">Дом / этаж</dt><dd class="tabular font-medium text-ink">{{ u.building }} · {{ u.floor }}</dd></div>
            <div v-if="u.section" class="flex justify-between gap-2"><dt class="text-muted">Секция</dt><dd class="tabular font-medium text-ink">{{ u.section }}</dd></div>
            <div class="flex justify-between gap-2"><dt class="text-muted">Площадь</dt><dd class="tabular font-medium text-ink">{{ fmtArea(u.area) }}</dd></div>
            <div v-if="u.purchasedAt" class="flex justify-between gap-2"><dt class="text-muted">Куплено</dt><dd class="tabular font-medium text-ink">{{ fmtDate(u.purchasedAt) }}</dd></div>
          </dl>

          <div class="mt-2.5 flex items-end justify-between gap-2 border-t border-line pt-2.5">
            <div>
              <p class="tabular text-[15px] font-semibold text-ink">{{ money(u.price) }}</p>
              <p v-if="u.discount" class="tabular text-[11px] text-ok">скидка {{ money(u.discount) }}</p>
            </div>
            <NuxtLink
              v-if="u.contractId" :to="`/contracts/${u.contractId}`"
              class="tabular shrink-0 text-[11.5px] font-semibold text-plum hover:underline"
            >{{ u.contractNumber }}</NuxtLink>
          </div>
        </div>
      </article>
    </div>

    <EmptyState v-else icon="ph:door" title="Помещений нет" text="У клиента пока нет ни одного договора — покупки появятся здесь автоматически" />
  </div>
</template>
