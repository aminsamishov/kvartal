<script setup lang="ts">
definePageMeta({ breadcrumb: [{ label: 'Мои объекты', to: '/objects' }, { label: 'Шахматка' }] })

/**
 * Шахматка — главный инструмент продаж. Страница тонкая: весь подбор живёт в
 * UnitPicker, чтобы шахматка, фасад, план этажа и список работали одинаково
 * здесь, в карточке заявки и в мастере сделок.
 */
const route = useRoute()
const board = useBoardStore()
const unitsStore = useUnitsStore()
const salesStore = useSalesStore()
const ui = useUiStore()

const SCOPE = 'board'
const scope = computed(() => board.scope(SCOPE))
const activeUnitId = ref<string | null>((route.query.unit as string) || null)

// ссылка вида /board?building=… приходит из карточки дома
onMounted(() => {
  const building = route.query.building as string | undefined
  if (building) board.setBuilding(SCOPE, building)
})

const projectId = computed(() => ui.currentProjectId)

const stats = computed(() => {
  const units = unitsStore.unitsByBuilding(scope.value.buildingId)
  const free = units.filter((u) => u.status === 'free').length
  const reserved = units.filter((u) => u.status === 'reserved').length
  return { total: units.length, free, reserved }
})

// брони на исходе — повод открыть шахматку с утра
const expiring = computed(() => salesStore.activeReservations
  .filter((r) => {
    const unit = unitsStore.unit(r.unitId)
    if (!unit || unit.buildingId !== scope.value.buildingId) return false
    return (new Date(r.expiresAt).getTime() - Date.now()) / 86400000 <= 3
  }).length)
</script>

<template>
  <div class="flex flex-col gap-4">
    <PageHeader
      title="Шахматка"
      :subtitle="`Разрез дома по секциям и этажам · ${stats.total} помещений, свободно ${stats.free}, в брони ${stats.reserved}`"
    >
      <template #actions>
        <AppButton v-if="expiring" icon="ph:hourglass" @click="board.setFilters(SCOPE, { ...scope.filters, statuses: ['reserved'] })">
          Брони на исходе
          <span class="grid h-4 min-w-4 place-items-center rounded-full bg-warn px-1 text-[10px] font-bold text-white">{{ expiring }}</span>
        </AppButton>
        <AppButton variant="primary" icon="ph:magic-wand" @click="navigateTo('/deals/new')">Новая сделка</AppButton>
      </template>
    </PageHeader>

    <UnitPicker
      :scope-key="SCOPE" :project-id="projectId" can-edit
      @open="activeUnitId = $event"
    />

    <UnitDrawer :unit-id="activeUnitId" @close="activeUnitId = null" @navigate="activeUnitId = $event" />
  </div>
</template>
