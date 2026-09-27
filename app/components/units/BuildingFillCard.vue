<script setup lang="ts">
import type { Building } from '~/types/models'
import { fmtDate } from '~/utils/format'

const props = defineProps<{ building: Building }>()
const unitsStore = useUnitsStore()

const stageLabel: Record<Building['constructionStage'], string> = {
  planning: 'Проектирование', foundation: 'Котлован', frame: 'Каркас', facade: 'Фасад', finishing: 'Отделка', commissioned: 'Сдан',
}

const fillKeys = ['board', 'layouts', 'floorPlans', 'facades', 'masterPlan'] as const
const percent = computed(() => unitsStore.fillPercent(props.building))
const doneCount = computed(() => fillKeys.filter((k) => props.building.fill[k]).length)

function openBoard(e: Event) {
  e.preventDefault()
  e.stopPropagation()
  navigateTo(`/board?building=${props.building.id}`)
}
</script>

<template>
  <NuxtLink :to="`/buildings/${building.id}`" class="group block rounded-card border border-line bg-panel p-[18px] shadow-card transition-all hover:-translate-y-px hover:shadow-rise">
    <div class="flex items-start justify-between gap-3">
      <div>
        <h3 class="text-[14px] font-semibold text-ink group-hover:text-plum">{{ building.name }}</h3>
        <p class="mt-0.5 text-[12px] text-muted">{{ stageLabel[building.constructionStage] }} · сдача {{ building.deliveryDate ? fmtDate(building.deliveryDate) : 'не указана' }}</p>
      </div>
      <AppButton size="sm" icon="ph:grid-nine" @click="openBoard">Шахматка</AppButton>
    </div>

    <div class="mt-4">
      <div class="flex items-center justify-between text-[11.5px] text-muted">
        <span>Готовность данных для показа покупателю</span>
        <span class="tabular font-semibold text-ink">{{ percent }}%</span>
      </div>
      <div class="mt-1.5 flex gap-1">
        <span v-for="k in fillKeys" :key="k" class="h-[5px] flex-1 rounded-full" :class="building.fill[k] ? 'bg-fill-ok' : 'bg-line'" />
      </div>
      <p class="mt-1.5 text-[11px] text-muted">{{ doneCount }} из {{ fillKeys.length }} разделов заполнены</p>
    </div>

    <div class="mt-3.5 flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-3 text-[11.5px] text-muted">
      <span class="flex items-center gap-1"><Icon name="ph:elevator" size="14" /> {{ building.elevatorsPassenger }} пасс. / {{ building.elevatorsFreight }} груз.</span>
      <span class="flex items-center gap-1"><Icon name="ph:trash" size="14" /> {{ building.hasTrashChute ? 'Мусоропровод' : 'Без мусоропровода' }}</span>
      <span class="flex items-center gap-1"><Icon name="ph:rows" size="14" /> {{ building.sections }} секц. · {{ building.floors }} эт.</span>
    </div>
  </NuxtLink>
</template>
