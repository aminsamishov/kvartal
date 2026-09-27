<script setup lang="ts">
import { TODAY } from '~/data/seed'
import { UNIT_STATUS_META } from '~/utils/meta'
import { fmtDate, money, moneyCompact } from '~/utils/format'
import { avgPricePerM2, lastMonths, seriesBy } from '~/utils/analytics'
import type { MetricItem } from '~/components/dashboard/MetricStrip.vue'
import type { UnitStatus } from '~/types/models'

const route = useRoute()
const unitsStore = useUnitsStore()
const dealsStore = useDealsStore()
const settingsStore = useSettingsStore()

const project = computed(() => unitsStore.project(route.params.id as string))
const buildingsAll = computed(() => (project.value ? unitsStore.buildingsByProject(project.value.id) : []))
const stats = computed(() => (project.value ? unitsStore.projectStats(project.value.id) : null))
const projectUnits = computed(() => (project.value ? unitsStore.unitsByProject(project.value.id) : []))

const buildingTab = ref<'active' | 'archive'>('active')
const buildings = computed(() => buildingsAll.value.filter((b) => (buildingTab.value === 'archive' ? b.archived : !b.archived)))

useBreadcrumb(() => [
  { label: 'Мои объекты', to: '/objects' },
  { label: project.value?.name ?? 'Проект' },
])

const propertyKindLabel: Record<string, string> = {
  residential: 'Жилой комплекс', commercial: 'Коммерческая недвижимость', mixed: 'Смешанный',
}

const showEditProject = ref(false)
const showCreateBuilding = ref(false)

/* ------------------------------- показатели ------------------------------- */

const months = computed(() => lastMonths(TODAY, 12))
const salesSeries = computed(() => seriesBy(
  months.value,
  dealsStore.contracts.filter((c) => c.projectId === project.value?.id),
  (c) => c.signedAt, (c) => c.price,
))

const metrics = computed<MetricItem[]>(() => {
  const s = stats.value
  const p = project.value
  if (!s || !p) return []
  return [
    {
      key: 'revenue', label: 'Выручка в работе', hero: true,
      value: moneyCompact(s.revenue, p.currency), unit: p.currency,
      hint: `${s.soldPct}% фонда реализовано · ${money(avgPricePerM2(projectUnits.value), p.currency)} за м²`,
      spark: salesSeries.value,
    },
    {
      key: 'total', label: 'Всего объектов', value: String(s.total),
      meter: { pct: s.soldPct, caption: `${buildingsAll.value.length} домов · реализовано ${s.soldPct}%` },
    },
    {
      key: 'free', label: 'Свободно', value: String(s.free), tone: 'ok',
      meter: { pct: (s.free / (s.total || 1)) * 100, caption: `${Math.round((s.free / (s.total || 1)) * 100)}% фонда` },
    },
    {
      key: 'reserved', label: 'В брони', value: String(s.reserved), tone: 'accent',
      meter: { pct: (s.reserved / (s.total || 1)) * 100, caption: 'ждут решения клиента' },
    },
    {
      key: 'deal', label: 'Продано и в рассрочке', value: String(s.sold + s.installment),
      meter: { pct: ((s.sold + s.installment) / (s.total || 1)) * 100, caption: `${s.sold} продано · ${s.installment} в рассрочке` },
    },
  ]
})

/* ------------------------------ структура фонда ---------------------------- */

const STATUS_ORDER: UnitStatus[] = ['sold', 'installment', 'reserved', 'free', 'closed']
const STATUS_COLOR: Record<UnitStatus, string> = {
  sold: 'var(--c-sold)', installment: 'var(--c-inst)', reserved: 'var(--c-reserve)',
  free: 'var(--c-free)', closed: 'var(--c-closed)',
}
const statusSegments = computed(() => STATUS_ORDER.map((status) => ({
  key: status,
  label: UNIT_STATUS_META[status].label,
  value: projectUnits.value.filter((u) => u.status === status).length,
  color: STATUS_COLOR[status],
})))

const infoRows = computed(() => {
  const p = project.value
  if (!p) return []
  return [
    ['Тип объекта', propertyKindLabel[p.propertyKind] ?? '—'],
    ['Застройщик', p.developer || 'не указан'],
    ['Адрес', p.address || 'не указан'],
    ['Стадия', p.stage || 'не указана'],
    ['Старт продаж', p.salesStart ? fmtDate(p.salesStart) : 'не указан'],
    ['Валюта', p.currency],
    ['Банки-партнёры', p.banks.join(', ') || 'не указаны'],
    ['Отдел продаж', settingsStore.salesOffices.find((o) => o.id === p.salesOfficeId)?.name ?? 'не указан'],
    ['Сайт', p.website || 'не указан'],
    ['Инфраструктура', p.infrastructure || 'не указана'],
  ] as [string, string][]
})
</script>

<template>
  <div v-if="project" class="flex flex-col gap-5">
    <PageHeader :title="project.name" :subtitle="`${project.address} · ${project.developer}`" eyebrow="Проект">
      <template #meta>
        <div class="mt-2.5 flex flex-wrap gap-1.5">
          <StatusTag tone="info" size="sm">{{ propertyKindLabel[project.propertyKind] }}</StatusTag>
          <StatusTag tone="neutral" size="sm">{{ project.stage }}</StatusTag>
          <StatusTag tone="neutral" size="sm">{{ project.currency }}</StatusTag>
          <StatusTag v-for="bank in project.banks" :key="bank" tone="neutral" size="sm" icon="ph:bank">{{ bank }}</StatusTag>
        </div>
      </template>
      <template #actions>
        <AppButton icon="ph:pencil-simple" @click="showEditProject = true">Редактировать</AppButton>
        <AppButton icon="ph:tag" @click="navigateTo('/pricing')">Прайс-лист</AppButton>
        <AppButton variant="primary" icon="ph:grid-nine" @click="navigateTo(`/board?project=${project.id}`)">Шахматка</AppButton>
      </template>
    </PageHeader>

    <MetricStrip :items="metrics" />

    <div class="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <AppCard title="Структура фонда" :subtitle="`${stats?.total ?? 0} помещений в проекте`">
        <ShareBar :segments="statusSegments" value-label="Помещений" />
      </AppCard>

      <AppCard title="Паспорт проекта" subtitle="Поля уходят на витрину и в договор">
        <template #actions>
          <button class="text-[12.5px] font-semibold text-plum hover:underline" @click="showEditProject = true">Изменить</button>
        </template>
        <dl class="flex flex-col">
          <div v-for="[label, value] in infoRows" :key="label" class="flex items-baseline justify-between gap-4 border-b border-line py-[7px] last:border-0">
            <dt class="shrink-0 text-[12px] text-muted">{{ label }}</dt>
            <dd class="truncate text-right text-[12.5px] font-medium text-ink">{{ value }}</dd>
          </div>
        </dl>
      </AppCard>

      <AppCard title="Генпланы" subtitle="Схема расположения домов на участке">
        <MediaGallery
          :items="project.masterPlans" accept="image/*" add-label="Загрузить генплан" empty-hint="Генпланы не загружены"
          @add="(f) => unitsStore.addMasterPlan(project!.id, f)" @remove="(id) => unitsStore.removeMasterPlan(project!.id, id)"
        />
      </AppCard>
    </div>

    <section>
      <SectionHeader title="Дома" :subtitle="`${buildingsAll.filter((b) => !b.archived).length} в продаже, ${buildingsAll.filter((b) => b.archived).length} в архиве`">
        <template #actions>
          <SegmentedControl v-model="buildingTab" :options="[{ value: 'active', label: 'Активные' }, { value: 'archive', label: 'Архив' }]" />
          <AppButton variant="primary" size="sm" icon="ph:plus-bold" @click="showCreateBuilding = true">Добавить дом</AppButton>
        </template>
      </SectionHeader>
      <div class="grid grid-cols-1 gap-3.5 xl:grid-cols-2">
        <BuildingFillCard v-for="b in buildings" :key="b.id" :building="b" />
      </div>
      <EmptyState
        v-if="!buildings.length" icon="ph:building-apartment"
        :title="buildingTab === 'archive' ? 'В архиве пусто' : 'В проекте пока нет домов'"
        :text="buildingTab === 'archive' ? undefined : 'Добавьте первый дом, чтобы начать наполнять шахматку'"
      >
        <template v-if="buildingTab === 'active'" #action><AppButton size="sm" variant="primary" @click="showCreateBuilding = true">Добавить дом</AppButton></template>
      </EmptyState>
    </section>

    <AppCard title="Медиаматериалы" subtitle="Фото и видео объекта — используются на витрине и в презентациях">
      <MediaGallery
        :items="project.media" allow-video add-label="Загрузить" empty-hint="Видео- и фото-материалы не загружены"
        @add="(f) => unitsStore.addMedia(project!.id, f)" @remove="(id) => unitsStore.removeMedia(project!.id, id)"
      />
    </AppCard>

    <ProjectEditPanel v-model="showEditProject" :project="project" />
    <BuildingEditPanel v-model="showCreateBuilding" :project-id="project.id" :building="null" />
  </div>
  <EmptyState v-else icon="ph:question" title="Проект не найден" class="mt-10" />
</template>
