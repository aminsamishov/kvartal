<script setup lang="ts">
import { area as fmtArea, fmtDate, fmtDateTime, money } from '~/utils/format'
import { UNIT_KIND_META } from '~/utils/meta'

const route = useRoute()
const unitsStore = useUnitsStore()
const pricingStore = usePricingStore()
const ui = useUiStore()

const draft = computed(() => pricingStore.draft(route.params.id as string))
useBreadcrumb(() => [{ label: 'Ценообразование', to: '/pricing' }, { label: 'Прайс-листы', to: '/pricing' }, { label: draft.value?.title ?? '…' }])

const tab = ref<'select' | 'items'>(draft.value?.items.length ? 'items' : 'select')

const search = ref('')
const buildingFilter = ref('')
const selected = ref<Set<string>>(new Set())
const bulkPct = ref(3)

const projectUnits = computed(() => (draft.value ? unitsStore.unitsByProject(draft.value.projectId) : []))
const buildings = computed(() => (draft.value ? unitsStore.buildingsByProject(draft.value.projectId) : []))

const filteredUnits = computed(() => projectUnits.value.filter((u) => {
  if (buildingFilter.value && u.buildingId !== buildingFilter.value) return false
  if (search.value && !u.number.toLowerCase().includes(search.value.toLowerCase())) return false
  return true
}))

function toggle(id: string) {
  selected.value.has(id) ? selected.value.delete(id) : selected.value.add(id)
  selected.value = new Set(selected.value)
}

function applyBulk() {
  if (!draft.value) return
  for (const id of selected.value) {
    const u = unitsStore.unit(id)
    if (!u) continue
    const newPrice = Math.round((u.price * (1 + bulkPct.value / 100)) / 10) * 10
    pricingStore.setItemPrice(draft.value.id, id, u.price, newPrice)
  }
  ui.toast(`Добавлено в проект: ${selected.value.size}`, 'ok')
  selected.value = new Set()
  tab.value = 'items'
}

function updateItemPrice(unitId: string, oldPrice: number, value: string) {
  if (!draft.value) return
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return
  pricingStore.setItemPrice(draft.value.id, unitId, oldPrice, n)
}

const showPublish = ref(false)
async function publish() {
  if (!draft.value) return
  await pricingStore.publish(draft.value.id)
  showPublish.value = false
  ui.toast('Прайс опубликован — новые цены видны на витрине и в КП', 'ok')
}

function diffPct(oldP: number, newP: number) {
  return Math.round(((newP - oldP) / oldP) * 1000) / 10
}
</script>

<template>
  <div v-if="draft" class="flex flex-col gap-5">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div class="flex items-center gap-2">
          <h1 class="text-[21px] font-semibold tracking-[-0.02em]">{{ draft.title }}</h1>
          <StatusTag :tone="draft.status === 'draft' ? 'warn' : 'ok'">{{ draft.status === 'draft' ? 'Черновик' : 'Опубликовано' }}</StatusTag>
        </div>
        <p class="mt-1 text-[13px] text-muted">
          Создан {{ fmtDate(draft.createdAt) }}<template v-if="draft.publishedAt"> · опубликован {{ fmtDateTime(draft.publishedAt) }}</template>
        </p>
      </div>
      <AppButton v-if="draft.status === 'draft'" variant="primary" icon="ph:rocket-launch" :disabled="!draft.items.length" @click="showPublish = true">
        Опубликовать ({{ draft.items.length }})
      </AppButton>
    </div>

    <p v-if="draft.status === 'draft'" class="flex items-start gap-2 rounded-xl2 border-l-4 border-warn bg-warn-bg px-4 py-3 text-[13px] text-warn">
      <Icon name="ph:info" size="17" class="mt-0.5 shrink-0" />
      Пока черновик не опубликован, витрина, расчёты и КП показывают прежнюю цену — прайс не «уедет» по ошибке.
    </p>

    <Tabs v-if="draft.status === 'draft'" v-model="tab" :tabs="[{ value: 'select', label: 'Выбор помещений', icon: 'ph:selection' }, { value: 'items', label: 'Список изменений', icon: 'ph:list-checks', count: draft.items.length }]" />

    <div v-if="tab === 'select' && draft.status === 'draft'" class="flex flex-col gap-4">
      <div class="flex flex-wrap items-end gap-2.5 rounded-card border border-line bg-panel p-4">
        <AppInput v-model="search" label="Поиск по номеру" placeholder="Например, 133" class="w-[160px]" />
        <AppSelect v-model="buildingFilter" label="Дом" :options="[{ value: '', label: 'Все дома' }, ...buildings.map((b) => ({ value: b.id, label: b.name }))]" class="w-[180px]" />
        <div class="ml-auto flex items-end gap-2">
          <AppInput v-model.number="bulkPct" type="number" label="Изменить цену, %" suffix="%" class="w-[140px]" />
          <AppButton variant="primary" icon="ph:plus-bold" :disabled="!selected.size" @click="applyBulk">Добавить в проект ({{ selected.size }})</AppButton>
        </div>
      </div>

      <div class="overflow-x-auto rounded-card border border-line">
        <table class="data-table">
          <thead>
            <tr>
              <th class="w-8" />
              <th>№</th><th>Тип</th><th>Площадь</th><th>Текущая цена</th><th>Новая цена ({{ bulkPct }}%)</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in filteredUnits" :key="u.id" class="cursor-pointer" @click="toggle(u.id)">
              <td><input type="checkbox" :checked="selected.has(u.id)" class="accent-plum" @click.stop="toggle(u.id)"></td>
              <td class="tabular font-semibold">{{ u.number }}</td>
              <td>{{ UNIT_KIND_META[u.kind].label }}</td>
              <td class="tabular">{{ fmtArea(u.area) }}</td>
              <td class="tabular">{{ money(u.price) }}</td>
              <td class="tabular font-semibold text-ok">{{ money(Math.round((u.price * (1 + bulkPct / 100)) / 10) * 10) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-else class="overflow-x-auto rounded-card border border-line">
      <table class="data-table">
        <thead><tr><th>№</th><th>Дом</th><th>Старая цена</th><th>Новая цена</th><th>Изменение</th><th v-if="draft.status === 'draft'" /></tr></thead>
        <tbody>
          <tr v-for="item in draft.items" :key="item.unitId">
            <td class="tabular font-semibold">{{ unitsStore.unit(item.unitId)?.number }}</td>
            <td>{{ unitsStore.building(unitsStore.unit(item.unitId)?.buildingId ?? '')?.name }}</td>
            <td class="tabular text-muted">{{ money(item.oldPrice) }}</td>
            <td class="tabular">
              <input
                v-if="draft.status === 'draft'" type="number" :value="item.newPrice" class="focus-ring w-24 rounded-lg border border-line px-2 py-1 tabular"
                @change="updateItemPrice(item.unitId, item.oldPrice, ($event.target as HTMLInputElement).value)"
              >
              <span v-else class="font-semibold">{{ money(item.newPrice) }}</span>
            </td>
            <td class="tabular font-semibold" :class="item.newPrice >= item.oldPrice ? 'text-ok' : 'text-bad'">
              {{ diffPct(item.oldPrice, item.newPrice) > 0 ? '+' : '' }}{{ diffPct(item.oldPrice, item.newPrice) }}%
            </td>
            <td v-if="draft.status === 'draft'">
              <button class="text-muted hover:text-bad" @click="pricingStore.removeItem(draft.id, item.unitId)"><Icon name="ph:trash" size="15" /></button>
            </td>
          </tr>
        </tbody>
      </table>
      <EmptyState v-if="!draft.items.length" compact icon="ph:tag" title="Пока нет объектов в проекте" text="Перейдите на вкладку «Выбор помещений»" />
    </div>

    <AppModal v-model="showPublish" title="Опубликовать прайс?" width="sm">
      <p class="text-[13.5px] text-muted">
        Новые цены ({{ draft.items.length }} объектов) станут видны на витрине, в КП и расчётах сразу после публикации. Отменить публикацию нельзя — только новым проектом изменений.
      </p>
      <div class="mt-4 flex gap-2">
        <AppButton variant="ghost" block @click="showPublish = false">Отмена</AppButton>
        <AppButton variant="primary" block @click="publish">Опубликовать</AppButton>
      </div>
    </AppModal>
  </div>
  <EmptyState v-else icon="ph:question" title="Проект изменений не найден" class="mt-10" />
</template>
