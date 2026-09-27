<script setup lang="ts">
import type { Building, Project, Unit } from '~/types/models'
import type { ZoneMark } from '~/components/units/UnitZoneCanvas.vue'
import { zoneBBox } from '~/utils/zones'
import { moneyCompact } from '~/utils/format'

/**
 * Генплан — верхний уровень навигации: ЖК → дом → фасад → этаж.
 * Менеджер начинает разговор с «вот наш квартал», а не со списка корпусов,
 * и дом на плане уже окрашен по тому, сколько в нём осталось.
 */
const props = defineProps<{
  scopeKey: string
  project: Project
  buildings: Building[]
  /** весь фонд проекта: по нему считается остаток в каждом доме */
  units: Unit[]
}>()
const emit = defineEmits<{ pick: [string] }>()

const board = useBoardStore()
const scope = computed(() => board.scope(props.scopeKey))

const image = computed(() => props.project.masterPlans[0]?.url ?? null)

function statsOf(buildingId: string) {
  const list = props.units.filter((u) => u.buildingId === buildingId)
  const free = list.filter((u) => u.status === 'free').length
  const sold = list.filter((u) => u.status === 'sold' || u.status === 'installment').length
  // «от» — про квартиры: кладовая за 970 $ в этой строке только вводит в
  // заблуждение, клиент спрашивает про жильё
  const prices = list.filter((u) => u.status === 'free' && u.kind === 'apartment').map((u) => u.price)
  return {
    total: list.length,
    free,
    sold,
    soldPct: list.length ? Math.round((sold / list.length) * 100) : 0,
    minPrice: prices.length ? Math.min(...prices) : 0,
  }
}

/**
 * Цвет дома — по остатку свободных: чем меньше осталось, тем «горячее».
 * Это первое, что спрашивает руководитель, глядя на квартал.
 */
function colorOf(buildingId: string) {
  const { total, free } = statsOf(buildingId)
  if (!total) return 'var(--c-closed)'
  const share = free / total
  if (share === 0) return 'var(--c-sold)'
  if (share < 0.2) return 'var(--c-inst)'
  if (share < 0.5) return 'var(--c-reserve)'
  return 'var(--c-free)'
}

const marks = computed<ZoneMark[]>(() => props.project.masterPlanZones.flatMap((z) => {
  const id = z.refId.replace('building:', '')
  const building = props.buildings.find((b) => b.id === id)
  if (!building) return []
  const b = zoneBBox(z)
  const stats = statsOf(building.id)
  return [{
    id: building.id,
    polygon: [{ x: b.x, y: b.y }, { x: b.x + b.w, y: b.y }, { x: b.x + b.w, y: b.y + b.h }, { x: b.x, y: b.y + b.h }],
    color: colorOf(building.id),
    label: building.name,
    sublabel: stats.free ? `свободно ${stats.free}` : 'всё продано',
    selected: scope.value.buildingId === building.id,
  }]
}))

function buildingOf(id: string) {
  return props.buildings.find((b) => b.id === id)
}
</script>

<template>
  <div class="flex flex-col gap-3 xl:flex-row">
    <div class="min-w-0 flex-1">
      <UnitZoneCanvas
        v-if="image" :image-url="image" :marks="marks" height="min(60vh, 560px)"
        @pick="emit('pick', $event)" @toggle="emit('pick', $event)"
      >
        <template #actions>
          <span class="text-[11.5px] text-muted">{{ project.name }} · {{ buildings.length }} дома · {{ units.length }} помещений</span>
        </template>
        <template #tip="{ mark }">
          <template v-if="buildingOf(mark.id)">
            <p class="text-[13px] font-semibold text-ink">{{ buildingOf(mark.id)!.name }}</p>
            <p class="mt-0.5 text-[11.5px] text-muted">
              {{ buildingOf(mark.id)!.floors }} этажей · {{ buildingOf(mark.id)!.sections }} секции
            </p>
            <dl class="mt-1.5 flex flex-col gap-0.5 text-[11.5px]">
              <div class="flex justify-between"><dt class="text-muted">Свободно</dt><dd class="tabular font-semibold">{{ statsOf(mark.id).free }} из {{ statsOf(mark.id).total }}</dd></div>
              <div class="flex justify-between"><dt class="text-muted">Реализация</dt><dd class="tabular font-medium">{{ statsOf(mark.id).soldPct }}%</dd></div>
              <div v-if="statsOf(mark.id).minPrice" class="flex justify-between"><dt class="text-muted">От</dt><dd class="tabular font-semibold">{{ moneyCompact(statsOf(mark.id).minPrice) }}</dd></div>
            </dl>
            <p class="mt-1 text-[11px] font-semibold text-plum">Открыть дом →</p>
          </template>
        </template>
      </UnitZoneCanvas>

      <EmptyState
        v-else icon="ph:map-trifold" title="Генплан не загружен"
        text="Загрузите генплан проекта — с него удобно начинать показ: квартал, дома, остаток по каждому"
      >
        <template #action>
          <AppButton size="sm" icon="ph:arrow-right" @click="navigateTo(`/objects/${project.id}`)">К проекту</AppButton>
        </template>
      </EmptyState>
    </div>

    <!-- корпуса списком: то же, что на плане, но с цифрами -->
    <aside class="flex shrink-0 flex-col gap-2 xl:w-[248px]">
      <button
        v-for="b in buildings" :key="b.id" type="button"
        class="focus-ring rounded-card border bg-panel p-3 text-left transition-colors hover:border-plum/50"
        :class="scope.buildingId === b.id ? 'border-ink' : 'border-line'"
        @click="emit('pick', b.id)"
      >
        <div class="flex items-center justify-between gap-2">
          <p class="truncate text-[13px] font-semibold text-ink">{{ b.name }}</p>
          <span class="h-2.5 w-2.5 shrink-0 rounded-full" :style="{ background: colorOf(b.id) }" />
        </div>
        <p class="mt-0.5 text-[11.5px] text-muted">{{ b.floors }} этажей · {{ statsOf(b.id).total }} помещений</p>
        <div class="mt-2 flex items-center gap-2">
          <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-soft">
            <span class="block h-full rounded-full bg-chart-accent" :style="{ width: `${statsOf(b.id).soldPct}%` }" />
          </div>
          <span class="tabular shrink-0 text-[11px] font-semibold text-ink">{{ statsOf(b.id).soldPct }}%</span>
        </div>
        <p class="mt-1.5 flex items-baseline justify-between text-[11.5px]">
          <span class="text-muted">Свободно <b class="tabular text-ink">{{ statsOf(b.id).free }}</b></span>
          <span v-if="statsOf(b.id).minPrice" class="tabular text-muted">от <b class="text-ink">{{ moneyCompact(statsOf(b.id).minPrice) }}</b></span>
        </p>
      </button>
    </aside>
  </div>
</template>
