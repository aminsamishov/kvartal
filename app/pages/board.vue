<script setup lang="ts">
import type { PickerView } from '~/stores/board'

const PICKER_VIEWS = ['master', 'board', 'facade', 'floor', 'list'] as const

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
const { can } = useAccess()

const SCOPE = 'board'
const scope = computed(() => board.scope(SCOPE))
const activeUnitId = ref<string | null>((route.query.unit as string) || null)

// ссылки в шахматку приходят из карточки проекта, карточки дома и генплана:
// /board?project=…&view=master, /board?building=…&view=facade
onMounted(() => {
  const q = route.query as Record<string, string | undefined>
  if (q.project && unitsStore.project(q.project)) ui.setProject(q.project)
  if (q.building) {
    board.setBuilding(SCOPE, q.building)
    // дом задан ссылкой — проект в шапке подтягиваем за ним, иначе подбор
    // покажет дома другого ЖК
    const projectOfBuilding = unitsStore.building(q.building)?.projectId
    if (projectOfBuilding) ui.setProject(projectOfBuilding)
  }
  if (q.view && (PICKER_VIEWS as readonly string[]).includes(q.view)) board.setView(SCOPE, q.view as PickerView)
  if (q.floor) board.setFloor(SCOPE, Number(q.floor))
})

const projectId = computed(() => ui.currentProjectId)

/** Договор из подбора: мастер сделок знает, с какой квартиры начать. */
function goContract(unitId: string) {
  navigateTo(`/deals/new?unit=${unitId}`)
}

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
  <!--
    Карточка помещения пристыкована справа, а не лежит поверх затемнения:
    шахматка под ней сужается, но остаётся рабочей. Менеджер открывает
    квартиру и тут же водит по соседним, сравнивая их, — с модальной
    карточкой её приходилось закрывать на каждый шаг.
  -->
  <div class="flex items-start gap-4">
    <div class="flex min-w-0 flex-1 flex-col gap-4">
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
        :scope-key="SCOPE" :project-id="projectId" :can-edit="can('unit.editStatus')"
        @open="activeUnitId = $event"
        @reserve="activeUnitId = $event"
        @contract="goContract"
      />
    </div>

    <UnitDrawer docked :unit-id="activeUnitId" @close="activeUnitId = null" @navigate="activeUnitId = $event" />
  </div>
</template>
