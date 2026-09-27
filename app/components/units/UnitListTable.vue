<script setup lang="ts">
import type { Unit } from '~/types/models'
import type { MatchedUnit } from '~/composables/useLeadMatching'
import type { ContextAction } from '~/components/ui/ContextMenu.vue'
import { UNIT_KIND_META, UNIT_STATUS_META } from '~/utils/meta'
import { area as fmtArea, money } from '~/utils/format'

const props = withDefaults(defineProps<{
  units: Unit[]
  dimIds?: Set<string>
  /** ключ скоупа подбора — с ним появляется колонка выделения */
  scopeKey?: string
  scores?: Map<string, MatchedUnit>
}>(), { dimIds: () => new Set<string>() })

const emit = defineEmits<{
  open: [string]
  reserve: [string]
  contract: [string]
}>()

const board = useBoardStore()
const selected = computed(() => new Set(props.scopeKey ? board.scope(props.scopeKey).selected : []))

type SortKey = 'number' | 'kind' | 'rooms' | 'area' | 'floor' | 'price' | 'perM2' | 'status' | 'score'
const sortKey = ref<SortKey>('number')
const sortDir = ref<1 | -1>(1)

// под клиента список по умолчанию сортируется по совпадению: первым идёт то,
// что менеджер покажет первым
watchEffect(() => {
  if (props.scores?.size && sortKey.value === 'number') {
    sortKey.value = 'score'
    sortDir.value = -1
  }
})

function toggleSort(key: SortKey) {
  if (sortKey.value === key) sortDir.value = sortDir.value === 1 ? -1 : 1
  else { sortKey.value = key; sortDir.value = key === 'score' ? -1 : 1 }
}

const sorted = computed(() => {
  const arr = [...props.units]
  const dir = sortDir.value
  const key = sortKey.value
  arr.sort((a, b) => {
    if (key === 'number') return dir * a.number.localeCompare(b.number, undefined, { numeric: true })
    if (key === 'kind') return dir * a.kind.localeCompare(b.kind)
    if (key === 'status') return dir * a.status.localeCompare(b.status)
    if (key === 'perM2') return dir * (a.price / a.area - b.price / b.area)
    if (key === 'score') return dir * ((props.scores?.get(a.id)?.score ?? -1) - (props.scores?.get(b.id)?.score ?? -1))
    return dir * ((a[key] as number) - (b[key] as number))
  })
  return arr
})

const columns = computed(() => {
  const base: { key: SortKey; label: string }[] = [
    { key: 'number', label: '№' }, { key: 'kind', label: 'Тип' }, { key: 'rooms', label: 'Комнат' },
    { key: 'area', label: 'Площадь' }, { key: 'floor', label: 'Этаж' }, { key: 'price', label: 'Цена' },
    { key: 'perM2', label: 'Цена / м²' }, { key: 'status', label: 'Статус' },
  ]
  return props.scores?.size ? [...base, { key: 'score' as SortKey, label: 'Совпадение' }] : base
})

/** Ширины колонок и клавиатура — как в остальных реестрах. */
const { style: colStyle, start: startResize, reset: resetColumn, active: resizing } = useColumnResize('units')
const { cursor } = useRowNavigation({
  count: () => sorted.value.length,
  onOpen: (i) => { const u = sorted.value[i]; if (u) emit('open', u.id) },
  onToggle: (i) => { const u = sorted.value[i]; if (u && props.scopeKey) board.toggleSelect(props.scopeKey, u.id) },
})

/* --------------------------- быстрые действия ----------------------------- */

const menu = useContextMenu<Unit>()
const ui = useUiStore()

const menuActions = computed<ContextAction[]>(() => {
  const u = menu.row.value
  return [
    { key: 'open', label: 'Открыть карточку', icon: 'ph:arrow-square-out', hint: '↵' },
    { key: 'reserve', label: 'Забронировать', icon: 'ph:bookmark-simple', hint: 'B', disabled: u?.status !== 'free' },
    { key: 'contract', label: 'Оформить договор', icon: 'ph:file-text', hint: 'D', disabled: u?.status === 'sold' || u?.status === 'installment' },
    { key: 'select', label: 'В сравнение', icon: 'ph:arrows-left-right', hint: 'C', disabled: !props.scopeKey, separated: true },
    { key: 'copy', label: 'Скопировать номер', icon: 'ph:copy' },
  ]
})

function onMenuPick(key: string) {
  const u = menu.row.value
  if (!u) return
  if (key === 'open') emit('open', u.id)
  if (key === 'reserve') emit('reserve', u.id)
  if (key === 'contract') emit('contract', u.id)
  if (key === 'select' && props.scopeKey) board.toggleSelect(props.scopeKey, u.id)
  if (key === 'copy') {
    navigator.clipboard?.writeText(u.number)
    ui.toast(`Номер № ${u.number} скопирован`, 'ok')
  }
}

const allSelected = computed(() => sorted.value.length > 0
  && sorted.value.every((u) => props.dimIds.has(u.id) || selected.value.has(u.id)))

function toggleAll() {
  if (!props.scopeKey) return
  const ids = sorted.value.filter((u) => !props.dimIds.has(u.id)).map((u) => u.id)
  if (allSelected.value) ids.forEach((id) => board.deselect(props.scopeKey!, id))
  else board.selectMany(props.scopeKey, ids)
}
</script>

<template>
  <div class="table-scroll rounded-card border border-line">
    <table class="data-table">
      <thead>
        <tr>
          <th v-if="scopeKey" class="w-9">
            <input type="checkbox" class="accent-plum" :checked="allSelected" title="Выделить всё" @change="toggleAll">
          </th>
          <th
            v-for="col in columns" :key="col.key" class="cursor-pointer select-none"
            :style="colStyle(col.key)" @click="toggleSort(col.key)"
          >
            <span class="inline-flex items-center gap-1">
              {{ col.label }}
              <Icon v-if="sortKey === col.key" :name="sortDir === 1 ? 'ph:caret-up' : 'ph:caret-down'" size="11" />
            </span>
            <span
              class="col-grip" :class="resizing === col.key ? 'is-active' : ''"
              title="Потяните, чтобы изменить ширину; двойной клик — автоширина"
              @pointerdown="startResize(col.key, $event)" @dblclick.stop="resetColumn(col.key)" @click.stop
            />
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(u, i) in sorted" :key="u.id" class="cursor-pointer"
          :class="[dimIds.has(u.id) ? 'opacity-35' : '', selected.has(u.id) ? 'bg-plum-soft/50' : '', cursor === i ? 'is-cursor' : '']"
          :data-row-index="i"
          @click="emit('open', u.id)"
          @contextmenu="menu.open($event, u)"
        >
          <td v-if="scopeKey" @click.stop>
            <input type="checkbox" class="accent-plum" :checked="selected.has(u.id)" @change="board.toggleSelect(scopeKey, u.id)">
          </td>
          <td class="tabular font-semibold">{{ u.number }}</td>
          <td>{{ UNIT_KIND_META[u.kind].label }}</td>
          <td class="tabular">{{ u.rooms || '—' }}</td>
          <td class="tabular">{{ fmtArea(u.area) }}</td>
          <td class="tabular">{{ u.floor }}</td>
          <td class="tabular font-semibold">{{ money(u.price) }}</td>
          <td class="tabular text-muted">{{ money(Math.round(u.price / u.area)) }}</td>
          <td><StatusTag :tone="UNIT_STATUS_META[u.status].tone" size="sm" dot>{{ UNIT_STATUS_META[u.status].label }}</StatusTag></td>
          <td v-if="scores?.size" class="tabular">
            <span
              v-if="scores.get(u.id)" class="rounded px-1.5 py-0.5 text-[11.5px] font-bold"
              :class="scores.get(u.id)!.score >= 90 ? 'bg-ok-bg text-ok' : scores.get(u.id)!.score >= 70 ? 'bg-soft text-ink' : 'text-muted'"
            >{{ scores.get(u.id)!.score }}%</span>
            <span v-else class="text-muted">—</span>
          </td>
        </tr>
      </tbody>
    </table>
    <EmptyState v-if="!sorted.length" compact icon="ph:grid-nine" title="Нет объектов" />

    <ContextMenu
      :x="menu.x.value" :y="menu.y.value" :actions="menuActions"
      :title="menu.row.value ? `№ ${menu.row.value.number}` : ''" @pick="onMenuPick" @close="menu.close()"
    />
  </div>
</template>
