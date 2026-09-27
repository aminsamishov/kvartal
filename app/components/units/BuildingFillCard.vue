<script setup lang="ts">
import type { Building } from '~/types/models'
import { fmtDate, moneyCompact } from '~/utils/format'

/**
 * Карточка дома. Раньше два дома в проекте выглядели одинаково — одинаковый
 * заголовок, одинаковые полоски, — и глаз не отличал их друг от друга.
 * Теперь у дома есть лицо (обложка фасада) и цифры продаж: остаток, реализация
 * и цена «от». Готовность данных осталась, но она больше не главный сюжет.
 */
const props = defineProps<{ building: Building }>()
const unitsStore = useUnitsStore()

const stageLabel: Record<Building['constructionStage'], string> = {
  planning: 'Проектирование', foundation: 'Котлован', frame: 'Каркас', facade: 'Фасад', finishing: 'Отделка', commissioned: 'Сдан',
}
const stageTone: Record<Building['constructionStage'], 'neutral' | 'info' | 'warn' | 'ok'> = {
  planning: 'neutral', foundation: 'neutral', frame: 'info', facade: 'info', finishing: 'warn', commissioned: 'ok',
}

const fillKeys = ['board', 'layouts', 'floorPlans', 'facades', 'masterPlan'] as const
const percent = computed(() => unitsStore.fillPercent(props.building))
const doneCount = computed(() => fillKeys.filter((k) => props.building.fill[k]).length)
const stats = computed(() => unitsStore.buildingStats(props.building.id))

/** Обложка: опубликованный ракурс важнее любого — его и видит покупатель. */
const cover = computed(() => {
  const facades = props.building.facades.filter((f) => f.imageUrl)
  return (facades.find((f) => f.published) ?? facades[0])?.imageUrl
    ?? props.building.floorPlans.find((f) => f.imageUrl)?.imageUrl
    ?? null
})

function openBoard(e: Event) {
  e.preventDefault()
  e.stopPropagation()
  navigateTo(`/board?building=${props.building.id}`)
}

function openFacade(e: Event) {
  e.preventDefault()
  e.stopPropagation()
  navigateTo(`/board?building=${props.building.id}&view=facade`)
}
</script>

<template>
  <NuxtLink
    :to="`/buildings/${building.id}`"
    class="group flex flex-col overflow-hidden rounded-card border border-line bg-panel shadow-card transition-all hover:-translate-y-px hover:shadow-rise sm:flex-row"
  >
    <!-- обложка фасада: дом должен отличаться от соседнего с первого взгляда -->
    <div class="relative h-[132px] w-full shrink-0 overflow-hidden bg-soft sm:h-auto sm:w-[164px]">
      <img v-if="cover" :src="cover" class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" :alt="building.name">
      <div v-else class="grid h-full w-full place-items-center text-muted">
        <div class="flex flex-col items-center gap-1">
          <Icon name="ph:image-square" size="22" />
          <span class="text-[10.5px]">нет фасада</span>
        </div>
      </div>
      <span
        v-if="cover" class="absolute inset-x-0 bottom-0 h-1"
        :style="{ background: `linear-gradient(90deg, var(--c-sold) ${stats.soldPct}%, var(--c-free) ${stats.soldPct}%)` }"
      />
      <button
        v-if="cover" type="button"
        class="focus-ring absolute right-2 top-2 rounded-lg bg-panel/85 px-2 py-1 text-[11px] font-semibold text-ink opacity-0 backdrop-blur transition-opacity group-hover:opacity-100"
        @click="openFacade"
      >Фасад</button>
    </div>

    <div class="min-w-0 flex-1 p-[18px]">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <h3 class="truncate text-[14px] font-semibold text-ink group-hover:text-plum">{{ building.name }}</h3>
          <p class="mt-1 flex flex-wrap items-center gap-1.5">
            <StatusTag :tone="stageTone[building.constructionStage]" size="sm">{{ stageLabel[building.constructionStage] }}</StatusTag>
            <span class="text-[11.5px] text-muted">сдача {{ building.deliveryDate ? fmtDate(building.deliveryDate) : 'не указана' }}</span>
          </p>
        </div>
        <AppButton size="sm" icon="ph:grid-nine" class="shrink-0" @click="openBoard">Шахматка</AppButton>
      </div>

      <!-- цифры продаж: то, зачем руководитель открывает проект -->
      <dl class="mt-3 grid grid-cols-3 gap-px overflow-hidden rounded-xl2 border border-line bg-line">
        <div class="bg-panel px-2.5 py-2">
          <dt class="text-[10.5px] uppercase tracking-[0.04em] text-muted">Свободно</dt>
          <dd class="tabular text-[15px] font-semibold text-ok">{{ stats.free }}<span class="ml-1 text-[11px] font-medium text-muted">/ {{ stats.total }}</span></dd>
        </div>
        <div class="bg-panel px-2.5 py-2">
          <dt class="text-[10.5px] uppercase tracking-[0.04em] text-muted">Реализация</dt>
          <dd class="tabular text-[15px] font-semibold text-ink">{{ stats.soldPct }}%</dd>
        </div>
        <div class="bg-panel px-2.5 py-2">
          <dt class="text-[10.5px] uppercase tracking-[0.04em] text-muted">Цена от</dt>
          <dd class="tabular text-[15px] font-semibold text-ink">{{ stats.minPrice ? moneyCompact(stats.minPrice) : '—' }}</dd>
        </div>
      </dl>

      <div class="mt-3">
        <div class="flex items-center justify-between text-[11.5px] text-muted">
          <span>Готовность данных для показа</span>
          <span class="tabular font-semibold text-ink">{{ percent }}% · {{ doneCount }}/{{ fillKeys.length }}</span>
        </div>
        <div class="mt-1.5 flex gap-1">
          <span v-for="k in fillKeys" :key="k" class="h-[5px] flex-1 rounded-full" :class="building.fill[k] ? 'bg-fill-ok' : 'bg-line'" />
        </div>
      </div>

      <div class="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-2.5 text-[11.5px] text-muted">
        <span class="flex items-center gap-1"><Icon name="ph:rows" size="14" /> {{ building.sections }} секц. · {{ building.floors }} эт.</span>
        <span class="flex items-center gap-1"><Icon name="ph:elevator" size="14" /> {{ building.elevatorsPassenger }} пасс. / {{ building.elevatorsFreight }} груз.</span>
        <span v-if="stats.reserved" class="flex items-center gap-1 text-warn"><Icon name="ph:bookmark-simple" size="14" /> {{ stats.reserved }} в брони</span>
      </div>
    </div>
  </NuxtLink>
</template>
