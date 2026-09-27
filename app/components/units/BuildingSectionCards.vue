<script setup lang="ts">
import type { Building } from '~/types/models'

const props = defineProps<{ building: Building }>()
const emit = defineEmits<{ select: [string]; import: [] }>()

const unitsStore = useUnitsStore()
const fill = computed(() => unitsStore.sectionFill(props.building))

interface SectionCard {
  key: string
  tab: string
  label: string
  icon: string
  percent: number
  detail: string
  primary: string
  secondary?: 'import'
}

const cards = computed<SectionCard[]>(() => {
  const b = props.building
  const units = unitsStore.unitsByBuilding(b.id)
  const plansWithImage = b.floorPlans.filter((f) => f.imageUrl).length
  const plansWithZones = b.floorPlans.filter((f) => f.imageUrl && f.zones.length).length
  const publishedFacades = b.facades.filter((f) => f.published && f.imageUrl).length
  const presetsWithImage = b.unitTypePresets.filter((p) => p.imageUrl).length
  return [
    {
      key: 'board', tab: 'board', label: 'Шахматка', icon: 'ph:grid-nine', percent: fill.value.board,
      detail: units.length ? `${units.length} помещений` : 'помещения не заведены',
      primary: units.length ? 'Редактировать' : 'Наполнить', secondary: 'import',
    },
    {
      key: 'presets', tab: 'presets', label: 'Планировки помещений', icon: 'ph:floor-plan', percent: fill.value.layouts,
      detail: b.unitTypePresets.length ? `${presetsWithImage} из ${b.unitTypePresets.length} с изображением` : 'планировки не добавлены',
      primary: b.unitTypePresets.length ? 'Редактировать' : 'Наполнить',
    },
    {
      key: 'floorplans', tab: 'floorplans', label: 'Планировки этажей', icon: 'ph:stack', percent: fill.value.floorPlans,
      detail: plansWithImage ? `${plansWithImage} планов, размечено ${plansWithZones}` : 'планы не загружены',
      primary: plansWithImage ? 'Редактировать' : 'Наполнить',
    },
    {
      key: 'facade', tab: 'facade', label: 'Фасады', icon: 'ph:buildings', percent: fill.value.facades,
      detail: b.facades.length ? `${b.facades.length} ракурсов, опубликовано ${publishedFacades}` : 'ракурсы не загружены',
      primary: b.facades.length ? 'Редактировать' : 'Наполнить',
    },
  ]
})

function tone(percent: number) {
  if (percent >= 90) return { text: 'text-ok', bar: 'bg-fill-ok', tile: 'bg-ok-bg text-ok' }
  if (percent >= 40) return { text: 'text-warn', bar: 'bg-board-warn', tile: 'bg-warn-bg text-warn' }
  return { text: 'text-muted', bar: 'bg-line', tile: 'bg-soft text-muted' }
}
</script>

<template>
  <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
    <article
      v-for="c in cards" :key="c.key"
      class="flex flex-col rounded-card border border-line bg-panel p-4 shadow-card transition-all hover:-translate-y-px hover:shadow-rise"
    >
      <div class="flex min-h-[44px] items-start gap-2.5">
        <span class="grid h-9 w-9 shrink-0 place-items-center rounded-xl2" :class="tone(c.percent).tile">
          <Icon :name="c.icon" size="18" />
        </span>
        <div class="min-w-0 flex-1">
          <h3 class="text-[13.5px] font-semibold leading-tight text-ink">{{ c.label }}</h3>
          <p class="mt-0.5 text-[11.5px] leading-snug text-muted">{{ c.detail }}</p>
        </div>
      </div>

      <div class="mt-auto pt-3.5">
        <div class="flex items-baseline justify-between">
          <span class="text-[11px] font-medium uppercase tracking-[0.03em] text-muted">Заполнение</span>
          <span class="tabular text-[18px] font-semibold tracking-[-0.02em]" :class="tone(c.percent).text">{{ c.percent }}%</span>
        </div>
        <div class="mt-1.5 h-[6px] overflow-hidden rounded-full bg-soft">
          <div class="h-full rounded-full transition-all" :class="tone(c.percent).bar" :style="{ width: `${Math.max(c.percent, 2)}%` }" />
        </div>
      </div>

      <div class="mt-3.5 flex gap-1.5">
        <AppButton size="sm" :variant="c.percent < 40 ? 'primary' : 'default'" block @click="emit('select', c.tab)">{{ c.primary }}</AppButton>
        <AppButton v-if="c.secondary === 'import'" size="sm" icon="ph:file-xls" title="Обновить из Excel" @click="emit('import')" />
      </div>
    </article>
  </div>
</template>
