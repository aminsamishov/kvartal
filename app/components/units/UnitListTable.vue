<script setup lang="ts">
import type { Unit } from '~/types/models'
import { UNIT_KIND_META, UNIT_STATUS_META } from '~/utils/meta'
import { area as fmtArea, money } from '~/utils/format'

const props = defineProps<{ units: Unit[]; dimIds: Set<string> }>()
defineEmits<{ open: [string] }>()

type SortKey = 'number' | 'kind' | 'rooms' | 'area' | 'floor' | 'price' | 'perM2' | 'status'
const sortKey = ref<SortKey>('number')
const sortDir = ref<1 | -1>(1)

function toggleSort(key: SortKey) {
  if (sortKey.value === key) sortDir.value = sortDir.value === 1 ? -1 : 1
  else { sortKey.value = key; sortDir.value = 1 }
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
    return dir * ((a[key] as number) - (b[key] as number))
  })
  return arr
})

const columns: { key: SortKey; label: string }[] = [
  { key: 'number', label: '№' }, { key: 'kind', label: 'Тип' }, { key: 'rooms', label: 'Комнат' },
  { key: 'area', label: 'Площадь' }, { key: 'floor', label: 'Этаж' }, { key: 'price', label: 'Цена' },
  { key: 'perM2', label: 'Цена / м²' }, { key: 'status', label: 'Статус' },
]
</script>

<template>
  <div class="overflow-x-auto rounded-card border border-line">
    <table class="data-table">
      <thead>
        <tr>
          <th v-for="col in columns" :key="col.key" class="cursor-pointer select-none" @click="toggleSort(col.key)">
            <span class="inline-flex items-center gap-1">
              {{ col.label }}
              <Icon v-if="sortKey === col.key" :name="sortDir === 1 ? 'ph:caret-up' : 'ph:caret-down'" size="11" />
            </span>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="u in sorted" :key="u.id" class="cursor-pointer" :class="dimIds.has(u.id) ? 'opacity-35' : ''"
          @click="$emit('open', u.id)"
        >
          <td class="tabular font-semibold">{{ u.number }}</td>
          <td>{{ UNIT_KIND_META[u.kind].label }}</td>
          <td class="tabular">{{ u.rooms || '—' }}</td>
          <td class="tabular">{{ fmtArea(u.area) }}</td>
          <td class="tabular">{{ u.floor }}</td>
          <td class="tabular font-semibold">{{ money(u.price) }}</td>
          <td class="tabular text-muted">{{ money(Math.round(u.price / u.area)) }}</td>
          <td><StatusTag :tone="UNIT_STATUS_META[u.status].tone" size="sm" dot>{{ UNIT_STATUS_META[u.status].label }}</StatusTag></td>
        </tr>
      </tbody>
    </table>
    <EmptyState v-if="!sorted.length" compact icon="ph:grid-nine" title="Нет объектов" />
  </div>
</template>
