<script setup lang="ts">
import { UNIT_STATUS_META } from '~/utils/meta'
import { money, moneyCompact, projectBadge } from '~/utils/format'
import { avgPricePerM2 } from '~/utils/analytics'
import type { MetricItem } from '~/components/dashboard/MetricStrip.vue'
import type { UnitStatus } from '~/types/models'

definePageMeta({ breadcrumb: [{ label: 'Мои объекты' }, { label: 'Проекты' }] })

const unitsStore = useUnitsStore()
const ui = useUiStore()
const { can } = useAccess()

/** Каталог правит тот, кто за него отвечает; продавец только смотрит. */
const canEdit = computed(() => can('objects.edit'))
/** Выручка проекта — деньги компании, а не инструмент продавца. */
const seesMoney = computed(() => can('dashboard.company'))

const tab = ref<'active' | 'archive'>('active')
const view = ref<'table' | 'cards'>('table')

const visible = computed(() => unitsStore.projects.filter((p) => (tab.value === 'archive' ? p.archived : !p.archived)))

const rows = computed(() => visible.value.map((p) => {
  const units = unitsStore.unitsByProject(p.id)
  const buildings = unitsStore.buildingsByProject(p.id)
  return {
    project: p,
    stats: unitsStore.projectStats(p.id),
    buildings: buildings.filter((b) => !b.archived).length,
    perM2: avgPricePerM2(units),
    readiness: buildings.length
      ? Math.round(buildings.reduce((s, b) => s + unitsStore.fillPercent(b), 0) / buildings.length)
      : 0,
  }
}))

const totals = computed<MetricItem[]>(() => {
  const active = unitsStore.projects.filter((p) => !p.archived)
  const units = unitsStore.units.filter((u) => active.some((p) => p.id === u.projectId))
  const revenue = active.reduce((s, p) => s + unitsStore.projectStats(p.id).revenue, 0)
  const free = units.filter((u) => u.status === 'free').length
  const soldish = units.filter((u) => u.status === 'sold' || u.status === 'installment').length
  const realised = units.length ? Math.round((soldish / units.length) * 100) : 0
  return [
    // продавцу вместо выручки компании — размер фонда, с которым он работает
    seesMoney.value
      ? {
          key: 'revenue', label: 'Выручка в работе', hero: true, value: moneyCompact(revenue), unit: 'USD',
          hint: `${realised}% фонда реализовано`,
        }
      : {
          key: 'free-hero', label: 'Свободно в продаже', hero: true, value: String(free), unit: 'помещений',
          hint: `${realised}% фонда уже в сделках`,
        },
    { key: 'projects', label: 'Проектов в продаже', value: String(active.length), hint: `${unitsStore.buildings.filter((b) => !b.archived).length} домов в продаже` },
    {
      key: 'units', label: 'Помещений в фонде', value: String(units.length),
      meter: { pct: units.length ? (soldish / units.length) * 100 : 0, caption: `${soldish} в сделках` },
    },
    {
      key: 'free', label: 'Свободно', value: String(free), tone: 'ok',
      meter: { pct: units.length ? (free / units.length) * 100 : 0, caption: `${units.length ? Math.round((free / units.length) * 100) : 0}% фонда` },
    },
    { key: 'm2', label: 'Средняя цена м²', value: money(avgPricePerM2(units)), hint: 'по фонду в продаже' },
  ]
})

function toggleArchive(id: string, e: Event) {
  e.preventDefault()
  e.stopPropagation()
  unitsStore.toggleProjectArchive(id)
  ui.toast('Проект перемещён', 'info')
}

const showEdit = ref(false)
const editingProject = ref<null | typeof unitsStore.projects[number]>(null)
function openCreate() {
  editingProject.value = null
  showEdit.value = true
}

const STATUS_ORDER: UnitStatus[] = ['sold', 'installment', 'reserved', 'free', 'closed']
const STATUS_COLOR: Record<UnitStatus, string> = {
  sold: 'var(--c-sold)', installment: 'var(--c-inst)', reserved: 'var(--c-reserve)',
  free: 'var(--c-free)', closed: 'var(--c-closed)',
}
/**
 * Обложка проекта. В узкой полосе карточки генплан превращается в серую
 * ленту — узнаётся именно дом, поэтому первым берём фасад, и только потом
 * фото с витрины и генплан.
 */
function coverOf(projectId: string) {
  const p = unitsStore.project(projectId)
  if (!p) return null
  const facades = unitsStore.buildingsByProject(projectId).flatMap((b) => b.facades).filter((f) => f.imageUrl)
  return (facades.find((f) => f.published) ?? facades[0])?.imageUrl
    ?? p.media.find((m) => m.kind === 'photo')?.url
    ?? p.masterPlans[0]?.url
    ?? null
}

function segments(projectId: string) {
  const units = unitsStore.unitsByProject(projectId)
  return STATUS_ORDER.map((status) => ({
    key: status,
    label: UNIT_STATUS_META[status].label,
    value: units.filter((u) => u.status === status).length,
    color: STATUS_COLOR[status],
  }))
}
</script>

<template>
  <div class="flex flex-col gap-5">
    <PageHeader
      title="Мои объекты" eyebrow="Портфель"
      subtitle="Одна база на все проекты — второй ЖК это новая запись, а не новая система"
    >
      <template #actions>
        <AppButton icon="ph:grid-nine" @click="navigateTo('/board')">Шахматка</AppButton>
        <AppButton v-if="canEdit" variant="primary" icon="ph:plus-bold" @click="openCreate">Новый проект</AppButton>
      </template>
    </PageHeader>

    <MetricStrip :items="totals" />

    <div class="flex flex-wrap items-center justify-between gap-3">
      <Tabs
        v-model="tab" :tabs="[
          { value: 'active', label: 'Активные', icon: 'ph:buildings', count: unitsStore.projects.filter((p) => !p.archived).length },
          { value: 'archive', label: 'Архив', icon: 'ph:archive', count: unitsStore.projects.filter((p) => p.archived).length },
        ]" class="flex-1 border-b-0"
      />
      <SegmentedControl
        :model-value="view"
        :options="[{ value: 'table', label: 'Таблица', icon: 'ph:table' }, { value: 'cards', label: 'Карточки', icon: 'ph:squares-four' }]"
        @update:model-value="view = $event as 'table' | 'cards'"
      />
    </div>

    <!-- таблица: числа выровнены по правому краю и в табличных цифрах -->
    <AppCard v-if="view === 'table' && rows.length" :padded="false" flush>
      <div class="overflow-x-auto">
        <table class="data-table">
          <thead>
            <tr>
              <th>Проект</th>
              <th>Структура фонда</th>
              <th class="text-right">Домов</th>
              <th class="text-right">Помещений</th>
              <th class="text-right">Свободно</th>
              <th class="text-right">Цена м²</th>
              <th class="w-[132px]">Реализация</th>
              <th class="w-[112px]">Готовность</th>
              <th v-if="seesMoney" class="text-right">Выручка</th>
              <th v-if="canEdit" class="w-9" />
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in rows" :key="r.project.id" class="cursor-pointer" @click="navigateTo(`/objects/${r.project.id}`)">
              <td>
                <div class="flex items-center gap-3">
                  <span
                    class="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-xl2 text-[11.5px] font-bold text-white"
                    :style="{ background: r.project.accent }"
                  >
                    <img v-if="r.project.media[0]" :src="r.project.media[0].url" class="h-full w-full object-cover" alt="">
                    <template v-else>{{ projectBadge(r.project.name) }}</template>
                  </span>
                  <div class="min-w-0">
                    <p class="truncate text-[13.5px] font-semibold text-ink">{{ r.project.name }}</p>
                    <p class="truncate text-[11.5px] text-muted">{{ r.project.address }}</p>
                  </div>
                </div>
              </td>
              <td class="min-w-[150px]">
                <div class="flex h-2.5 w-full overflow-hidden rounded-full" style="gap: 2px">
                  <span
                    v-for="s in segments(r.project.id).filter((x) => x.value)" :key="s.key"
                    class="h-full first:rounded-l-full last:rounded-r-full"
                    :style="{ width: `${(s.value / (r.stats.total || 1)) * 100}%`, background: s.color }"
                    :title="`${s.label}: ${s.value}`"
                  />
                </div>
              </td>
              <td class="tabular text-right">{{ r.buildings }}</td>
              <td class="tabular text-right font-semibold">{{ r.stats.total }}</td>
              <td class="tabular text-right">{{ r.stats.free }}</td>
              <td class="tabular text-right">{{ money(r.perM2, r.project.currency) }}</td>
              <td>
                <div class="flex items-center gap-2">
                  <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-soft">
                    <span class="block h-full rounded-full bg-chart-accent" :style="{ width: `${r.stats.soldPct}%` }" />
                  </div>
                  <span class="tabular w-8 shrink-0 text-right text-[12px] font-semibold">{{ r.stats.soldPct }}%</span>
                </div>
              </td>
              <td>
                <StatusTag size="sm" :tone="r.readiness >= 80 ? 'ok' : r.readiness >= 40 ? 'warn' : 'neutral'">{{ r.readiness }}%</StatusTag>
              </td>
              <td v-if="seesMoney" class="tabular text-right font-semibold">{{ moneyCompact(r.stats.revenue, r.project.currency) }}</td>
              <td v-if="canEdit">
                <button
                  type="button" class="focus-ring grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-soft hover:text-ink"
                  :title="r.project.archived ? 'Вернуть из архива' : 'В архив'" @click="toggleArchive(r.project.id, $event)"
                >
                  <Icon :name="r.project.archived ? 'ph:archive-tray' : 'ph:archive'" size="14" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </AppCard>

    <!-- карточки -->
    <div v-else-if="rows.length" class="grid grid-cols-1 gap-3.5 xl:grid-cols-2">
      <NuxtLink
        v-for="r in rows" :key="r.project.id" :to="`/objects/${r.project.id}`"
        class="group flex flex-col overflow-hidden rounded-card border border-line bg-panel shadow-card transition-all hover:-translate-y-px hover:shadow-rise"
      >
        <!-- обложка: проекты должны отличаться друг от друга с первого взгляда -->
        <div class="relative h-[96px] w-full overflow-hidden bg-soft">
          <img
            v-if="coverOf(r.project.id)" :src="coverOf(r.project.id)!"
            class="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.02]" alt=""
          >
          <div
            v-else class="h-full w-full"
            :style="{ background: `linear-gradient(135deg, ${r.project.accent}, ${r.project.accent}88)` }"
          />
          <span class="absolute inset-x-0 bottom-0 h-1" :style="{ background: r.project.accent }" />
        </div>

        <div class="flex flex-col gap-4 p-[18px]">
        <div class="flex items-start gap-3.5">
          <span
            class="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl2 text-[14px] font-bold text-white"
            :style="{ background: r.project.accent }"
          >{{ projectBadge(r.project.name) }}</span>
          <div class="min-w-0 flex-1">
            <h3 class="truncate text-[15px] font-semibold text-ink group-hover:text-plum">{{ r.project.name }}</h3>
            <p class="truncate text-[12px] text-muted">{{ r.project.address }} · {{ r.project.stage }}</p>
          </div>
          <div class="shrink-0 text-right">
            <p class="text-[10.5px] uppercase tracking-[0.04em] text-muted">{{ seesMoney ? 'Выручка' : 'Свободно' }}</p>
            <p class="text-[17px] font-semibold tracking-[-0.02em] text-ink">
              {{ seesMoney ? moneyCompact(r.stats.revenue, r.project.currency) : r.stats.free }}
            </p>
          </div>
        </div>

        <ShareBar :segments="segments(r.project.id)" value-label="Помещений" hide-table-toggle />

        <dl class="grid grid-cols-4 gap-px overflow-hidden rounded-xl2 border border-line bg-line">
          <div v-for="c in [
            { l: 'Домов', v: String(r.buildings) },
            { l: 'Помещений', v: String(r.stats.total) },
            { l: 'Цена м²', v: money(r.perM2, r.project.currency) },
            { l: 'Реализация', v: `${r.stats.soldPct}%` },
          ]" :key="c.l" class="bg-panel px-2.5 py-2"
          >
            <dt class="text-[10.5px] uppercase tracking-[0.03em] text-muted">{{ c.l }}</dt>
            <dd class="tabular mt-0.5 text-[13.5px] font-semibold text-ink">{{ c.v }}</dd>
          </div>
        </dl>
        </div>
      </NuxtLink>
    </div>

    <EmptyState v-else icon="ph:buildings" :title="tab === 'archive' ? 'В архиве пусто' : 'Проектов пока нет'">
      <template v-if="tab === 'active' && canEdit" #action><AppButton size="sm" variant="primary" icon="ph:plus-bold" @click="openCreate">Новый проект</AppButton></template>
    </EmptyState>

    <ProjectEditPanel v-if="canEdit" v-model="showEdit" :project="editingProject" />
  </div>
</template>
