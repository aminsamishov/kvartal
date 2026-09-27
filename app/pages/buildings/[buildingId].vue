<script setup lang="ts">
import { fmtDate } from '~/utils/format'
import { UNIT_KIND_META } from '~/utils/meta'

const route = useRoute()
const router = useRouter()
const unitsStore = useUnitsStore()
const settingsStore = useSettingsStore()
const ui = useUiStore()

const building = computed(() => unitsStore.building(route.params.buildingId as string))
const project = computed(() => (building.value ? unitsStore.project(building.value.projectId) : undefined))
useBreadcrumb(() => [
  { label: 'Мои объекты', to: '/objects' },
  { label: project.value?.name ?? '…', to: `/objects/${project.value?.id}` },
  { label: building.value?.name ?? '…' },
])

type BuildingTab = 'overview' | 'board' | 'presets' | 'floorplans' | 'facade'
const TABS: BuildingTab[] = ['overview', 'board', 'presets', 'floorplans', 'facade']

// таб держим в адресе: со страницы разметки фасада возвращаемся туда же,
// откуда ушли, и ссылкой на конкретный раздел можно поделиться
const tab = ref<BuildingTab>(TABS.includes(route.query.tab as BuildingTab) ? (route.query.tab as BuildingTab) : 'overview')
watch(tab, (v) => router.replace({ query: { ...route.query, tab: v === 'overview' ? undefined : v } }))

const boardMode = ref<'manual' | 'import'>('manual')

function goSection(next: string) {
  tab.value = next as BuildingTab
  boardMode.value = 'manual'
}
function goImport() {
  tab.value = 'board'
  boardMode.value = 'import'
}

const unitsCount = computed(() => (building.value ? unitsStore.unitsByBuilding(building.value.id).length : 0))
const fillPercent = computed(() => (building.value ? unitsStore.fillPercent(building.value) : 0))

const stageLabel: Record<string, string> = { planning: 'Проектирование', foundation: 'Котлован', frame: 'Каркас', facade: 'Фасад', finishing: 'Отделка', commissioned: 'Сдан' }

const showEdit = ref(false)

const office = computed(() => settingsStore.salesOffices.find((o) => o.id === building.value?.salesOfficeId))

function toggleArchive() {
  if (!building.value) return
  unitsStore.toggleBuildingArchive(building.value.id)
  ui.toast(building.value.archived ? 'Дом отправлен в архив' : 'Дом возвращён из архива', 'info')
}

const fillRows = computed(() => {
  const b = building.value
  if (!b) return []
  return [
    { label: 'Шахматка помещений', done: b.fill.board, tab: 'board' },
    { label: 'Планировки помещений', done: b.fill.layouts, tab: 'presets' },
    { label: 'Планы этажей', done: b.fill.floorPlans, tab: 'floorplans' },
    { label: 'Фасады', done: b.fill.facades, tab: 'facade' },
    { label: 'Генплан проекта', done: b.fill.masterPlan, tab: '' },
  ]
})

const infoRows = computed(() => {
  const b = building.value
  if (!b) return []
  return [
    ['ЖК', project.value?.name ?? '—'],
    ['Тип помещений по умолчанию', UNIT_KIND_META[b.defaultUnitKind]?.label ?? '—'],
    ['Тип строения', b.structureType === 'residential' ? 'Жилое' : 'Нежилое'],
    ['Адрес', b.address || 'не указан'],
    ['Адрес по договору', b.contractAddress || 'не указан'],
    ['Отделка помещений', b.finishing || 'не указана'],
    ['Материал дома', b.material || 'не указан'],
    ['Стадия строительства', stageLabel[b.constructionStage] ?? b.constructionStage],
    ['Сроки строительства', b.constructionStart && b.constructionEnd ? `${fmtDate(b.constructionStart)} — ${fmtDate(b.constructionEnd)}` : 'не указаны'],
    ['Срок сдачи в эксплуатацию', b.deliveryDate ? fmtDate(b.deliveryDate) : 'не указан'],
    ['Старт / окончание продаж', `${b.salesStart ? fmtDate(b.salesStart) : 'не указано'} — ${b.salesEnd ? fmtDate(b.salesEnd) : 'не указано'}`],
    ['Офис продаж', office.value?.name ?? 'не указан'],
    ['Кадастровый номер земли', b.cadastralNumber || 'не указано'],
    ['Подъездов', String(b.sections)],
    ['Этажей', `${b.floors} надземных, ${b.floorsBelow} подземных`],
    ['Лифты', `${b.elevatorsPassenger} пассажирских / ${b.elevatorsFreight} грузовых`],
    ['Мусоропровод', b.hasTrashChute ? 'Есть' : 'Нет'],
    ['Наличие шоурума в доме', b.hasShowroom ? 'Есть' : 'Нет'],
    ['Рекламный слоган', b.slogan || 'не указан'],
  ] as [string, string][]
})
</script>

<template>
  <div v-if="building" class="flex flex-col gap-5">
    <BuildingHeader
      :building="building" :project="project" :fill-percent="fillPercent"
      @edit="showEdit = true" @archive="toggleArchive"
    />

    <BuildingSectionCards :building="building" @select="goSection" @import="goImport" />

    <Tabs
      :model-value="tab" :tabs="[
        { value: 'overview', label: 'Обзор', icon: 'ph:info' },
        { value: 'board', label: 'Шахматка', icon: 'ph:grid-nine', count: unitsCount || undefined },
        { value: 'presets', label: 'Планировки помещений', icon: 'ph:floor-plan', count: building.unitTypePresets.length || undefined },
        { value: 'floorplans', label: 'Планировки этажей', icon: 'ph:stack', count: building.floorPlans.filter((f) => f.imageUrl).length || undefined },
        { value: 'facade', label: 'Фасады', icon: 'ph:buildings', count: building.facades.length || undefined },
      ]" @update:model-value="goSection"
    />

    <!-- обзор: данные дома + боковая колонка; редакторы разделов — на всю ширину -->
    <div v-if="tab === 'overview'" class="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
      <AppCard title="Информация о доме" subtitle="Эти поля уходят на витрину, в PDF-презентацию и в договор">
        <template #actions><AppButton size="sm" icon="ph:pencil-simple" @click="showEdit = true">Редактировать</AppButton></template>
        <dl class="grid grid-cols-1 gap-x-7 sm:grid-cols-2">
          <div v-for="[label, value] in infoRows" :key="label" class="flex items-baseline justify-between gap-3 border-b border-line py-2">
            <dt class="text-[12px] text-muted">{{ label }}</dt>
            <dd class="text-right text-[13px] font-medium text-ink">{{ value }}</dd>
          </div>
        </dl>
      </AppCard>

      <div class="flex flex-col gap-4">
        <AppCard title="Готовность к показу">
          <div class="flex items-center justify-between text-[11.5px] text-muted">
            <span>Данные для покупателя</span>
            <span class="tabular font-semibold text-ink">{{ fillPercent }}%</span>
          </div>
          <ProgressBar :percent="fillPercent" tone="ok" :show-label="false" class="mt-1.5" />
          <div class="mt-4 flex flex-col gap-2">
            <button
              v-for="row in fillRows" :key="row.label" type="button"
              class="focus-ring -mx-1.5 flex items-center gap-2 rounded-lg px-1.5 py-1 text-left text-[12.5px] hover:bg-soft"
              @click="row.tab ? goSection(row.tab) : navigateTo(`/objects/${project?.id}`)"
            >
              <Icon :name="row.done ? 'ph:check-circle-fill' : 'ph:circle-dashed'" :class="row.done ? 'text-ok' : 'text-muted'" size="15" />
              <span :class="row.done ? 'text-ink' : 'text-muted'">{{ row.label }}</span>
              <Icon name="ph:arrow-right" size="12" class="ml-auto text-muted" />
            </button>
          </div>
        </AppCard>

        <AppCard title="Обложка для PDF" subtitle="Первая страница презентации дома">
          <MediaGallery
            :items="building.pdfImageUrl ? [{ id: 'pdf', url: building.pdfImageUrl, name: 'Обложка', kind: 'photo', addedAt: '' }] : []"
            add-label="Загрузить" empty-hint="Изображение не выбрано"
            @add="(f) => unitsStore.setBuildingPdfImage(building!.id, f.url)"
            @remove="() => unitsStore.setBuildingPdfImage(building!.id, null)"
          />
        </AppCard>
      </div>
    </div>

    <div v-else-if="tab === 'board'" class="flex flex-col gap-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          v-model="boardMode"
          :options="[{ value: 'manual', label: 'Детализация по этажам', icon: 'ph:table' }, { value: 'import', label: 'Импорт из Excel', icon: 'ph:file-xls' }]"
        />
        <AppButton size="sm" variant="primary" icon="ph:grid-nine" @click="navigateTo(`/board?building=${building.id}`)">Открыть шахматку</AppButton>
      </div>
      <ManualBoardEditor v-if="boardMode === 'manual'" :building="building" />
      <ImportUnitsWizard v-else :building="building" />
    </div>

    <FloorPlansEditor v-else-if="tab === 'floorplans'" :building="building" />
    <UnitTypePresetsEditor v-else-if="tab === 'presets'" :building="building" />
    <FacadesEditor v-else-if="tab === 'facade'" :building="building" />

    <BuildingEditPanel v-model="showEdit" :project-id="project?.id ?? ''" :building="building" />
  </div>
  <EmptyState v-else icon="ph:question" title="Дом не найден" class="mt-10" />
</template>
