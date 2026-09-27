<script setup lang="ts">
import type { ClientProfile } from '~/utils/clientProfile'
import { CLIENT_STATUS_META } from '~/utils/clientProfile'
import { CLIENT_COLUMNS, clientSortValue, type ClientColumnKey } from '~/utils/clientColumns'
import { fmtDate, fmtPhone, money, moneyCompact } from '~/utils/format'

/**
 * Реестр покупателей таблицей, а не карточками: руководитель сравнивает
 * клиентов между собой — кто должен, кто просрочил, кто чей, — и для этого
 * нужны строки одинаковой формы, сортировка и плотность.
 *
 * Первая колонка закреплена: при горизонтальной прокрутке строка без имени
 * превращается в набор цифр непонятно про кого.
 */
const props = defineProps<{
  profiles: ClientProfile[]
  visibleKeys: ClientColumnKey[]
  selected: string[]
  sortKey: ClientColumnKey
  sortDir: 1 | -1
}>()

const emit = defineEmits<{
  open: [string]
  sort: [ClientColumnKey]
  'update:selected': [string[]]
}>()

const columns = computed(() => CLIENT_COLUMNS.filter((c) => c.required || props.visibleKeys.includes(c.key)))

const sorted = computed(() => {
  const dir = props.sortDir
  return [...props.profiles].sort((a, b) => {
    const va = clientSortValue(a, props.sortKey)
    const vb = clientSortValue(b, props.sortKey)
    if (typeof va === 'number' && typeof vb === 'number') return dir * (va - vb)
    return dir * String(va).localeCompare(String(vb), 'ru')
  })
})

const selectedSet = computed(() => new Set(props.selected))
const allSelected = computed(() => sorted.value.length > 0 && sorted.value.every((p) => selectedSet.value.has(p.client.id)))

function toggleAll() {
  emit('update:selected', allSelected.value ? [] : sorted.value.map((p) => p.client.id))
}
function toggleOne(id: string) {
  emit('update:selected', selectedSet.value.has(id)
    ? props.selected.filter((x) => x !== id)
    : [...props.selected, id])
}
function onRowClick(id: string, e: MouseEvent) {
  if (e.metaKey || e.ctrlKey || e.shiftKey) toggleOne(id)
  else emit('open', id)
}

function dueTone(p: ClientProfile) {
  const next = p.totals.nextDue
  if (!next) return 'text-muted'
  if (next.state === 'overdue') return 'text-bad font-semibold'
  if (next.state === 'today') return 'text-warn font-semibold'
  return 'text-ink'
}
</script>

<template>
  <div class="overflow-x-auto rounded-card border border-line bg-panel">
    <table class="data-table client-table">
      <thead>
        <tr>
          <th class="pin w-10">
            <input type="checkbox" class="accent-plum" :checked="allSelected" title="Выделить всё" @change="toggleAll">
          </th>
          <th
            v-for="col in columns" :key="col.key"
            class="cursor-pointer select-none"
            :class="[col.align === 'right' ? 'text-right' : '', col.key === 'client' ? 'pin pin--name' : '']"
            :style="{ minWidth: col.width }"
            @click="emit('sort', col.key)"
          >
            <span class="inline-flex items-center gap-1" :class="col.align === 'right' ? 'flex-row-reverse' : ''">
              {{ col.label }}
              <Icon v-if="sortKey === col.key" :name="sortDir === 1 ? 'ph:caret-up' : 'ph:caret-down'" size="11" />
            </span>
          </th>
        </tr>
      </thead>

      <tbody>
        <tr
          v-for="p in sorted" :key="p.client.id"
          class="group cursor-pointer"
          :class="selectedSet.has(p.client.id) ? 'is-selected' : ''"
          @click="onRowClick(p.client.id, $event)"
        >
          <td class="pin" @click.stop>
            <input type="checkbox" class="accent-plum" :checked="selectedSet.has(p.client.id)" @change="toggleOne(p.client.id)">
          </td>

          <td v-for="col in columns" :key="col.key" :class="[col.align === 'right' ? 'text-right' : '', col.key === 'client' ? 'pin pin--name' : '']">
            <!-- клиент -->
            <template v-if="col.key === 'client'">
              <span class="flex items-center gap-2.5">
                <AppAvatar :name="p.client.name" size="sm" :color="p.manager?.avatarColor" />
                <span class="min-w-0">
                  <span class="flex items-center gap-1.5">
                    <span class="truncate text-[13px] font-semibold text-ink">{{ p.client.name }}</span>
                    <Icon v-if="p.client.vip" name="ph:star-fill" size="11" class="shrink-0 text-warn" title="VIP-клиент" />
                  </span>
                  <span class="block truncate text-[11px] text-muted">
                    {{ p.client.kind === 'company' ? 'Юрлицо' : 'Физлицо' }}
                    <template v-if="p.client.source"> · {{ p.client.source }}</template>
                  </span>
                </span>
              </span>
            </template>

            <!-- телефон -->
            <template v-else-if="col.key === 'phone'">
              <a
                v-if="p.client.phone" :href="`tel:+${p.client.phone}`" class="tabular hover:text-plum hover:underline"
                @click.stop
              >{{ fmtPhone(p.client.phone) }}</a>
              <span v-else class="text-muted">—</span>
            </template>

            <template v-else-if="col.key === 'project'">
              <span v-if="p.project" class="flex items-center gap-1.5">
                <span class="h-2 w-2 shrink-0 rounded-full" :style="{ background: p.project.accent }" />
                <span class="truncate">{{ p.project.name }}</span>
                <span v-if="p.projects.length > 1" class="shrink-0 text-[11px] text-muted">+{{ p.projects.length - 1 }}</span>
              </span>
              <span v-else class="text-muted">—</span>
            </template>

            <template v-else-if="col.key === 'units'">
              <span class="tabular font-semibold">{{ p.totals.unitsCount }}</span>
              <span v-if="p.totals.area" class="ml-1 text-[11px] text-muted">{{ p.totals.area }} м²</span>
            </template>

            <template v-else-if="col.key === 'manager'">
              <span v-if="p.manager" class="flex items-center gap-2">
                <AppAvatar :name="p.manager.name" size="sm" :color="p.manager.avatarColor" />
                <span class="truncate text-[12.5px]">{{ p.manager.name }}</span>
              </span>
              <span v-else class="text-muted">—</span>
            </template>

            <template v-else-if="col.key === 'contract'">
              <NuxtLink
                v-if="p.contracts[0]" :to="`/contracts/${p.contracts[0].id}`"
                class="tabular font-medium hover:text-plum hover:underline" @click.stop
              >{{ p.contracts[0].number }}</NuxtLink>
              <span v-else class="text-muted">—</span>
              <span v-if="p.contracts.length > 1" class="ml-1 text-[11px] text-muted">+{{ p.contracts.length - 1 }}</span>
            </template>

            <template v-else-if="col.key === 'status'">
              <StatusTag :tone="CLIENT_STATUS_META[p.status].tone" size="sm" dot>{{ CLIENT_STATUS_META[p.status].label }}</StatusTag>
            </template>

            <template v-else-if="col.key === 'paid'">
              <span class="tabular font-semibold">{{ money(p.totals.paid) }}</span>
              <span class="ml-1 text-[11px] text-muted">{{ p.totals.paidPct }}%</span>
            </template>

            <template v-else-if="col.key === 'remaining'">
              <span class="tabular" :class="p.totals.remaining ? 'font-semibold text-ink' : 'text-muted'">
                {{ p.totals.remaining ? money(p.totals.remaining) : '—' }}
              </span>
            </template>

            <template v-else-if="col.key === 'nextDue'">
              <span v-if="p.totals.nextDue" class="tabular" :class="dueTone(p)">
                {{ fmtDate(p.totals.nextDue.dueDate) }}
                <span class="text-[11px] font-normal text-muted">· {{ moneyCompact(p.totals.nextDue.remaining) }}</span>
              </span>
              <span v-else class="text-muted">—</span>
            </template>

            <template v-else-if="col.key === 'overdue'">
              <span
                v-if="p.totals.overdueDays" class="tabular rounded px-1.5 py-0.5 text-[11.5px] font-bold"
                :class="p.totals.overdueDays > 30 ? 'bg-bad-bg text-bad' : 'bg-warn-bg text-warn'"
                :title="`Просрочено ${money(p.totals.overdueAmount)}`"
              >{{ p.totals.overdueDays }} дн.</span>
              <span v-else class="text-muted">—</span>
            </template>

            <template v-else-if="col.key === 'purchaseAt'">
              <span v-if="p.purchaseAt" class="tabular">{{ fmtDate(p.purchaseAt) }}</span>
              <span v-else class="text-muted">—</span>
            </template>

            <template v-else-if="col.key === 'lastActivity'">
              <span v-if="p.lastActivityAt" class="truncate">
                <span class="tabular text-muted">{{ fmtDate(p.lastActivityAt) }}</span>
                <span class="ml-1 text-[12px]">{{ p.lastActivityLabel }}</span>
              </span>
              <span v-else class="text-muted">—</span>
            </template>
          </td>
        </tr>
      </tbody>
    </table>

    <EmptyState v-if="!sorted.length" compact icon="ph:users-three" title="Под фильтр никто не подходит" text="Сбросьте условия или расширьте период" />
  </div>
</template>

<style scoped>
/* закреплённые колонки: собственный фон, иначе при прокрутке сквозь них
   просвечивают остальные ячейки; hover и выделение фон подменяют */
.client-table :deep(.pin) {
  position: sticky;
  left: 0;
  z-index: 2;
  background: var(--panel);
}
.client-table :deep(.pin--name) {
  left: 40px;
  box-shadow: 1px 0 0 var(--line);
}
.client-table :deep(thead .pin) {
  z-index: 3;
}
.client-table :deep(tbody tr:hover .pin) {
  background: var(--soft);
}
.client-table :deep(tbody tr.is-selected) {
  background: color-mix(in srgb, var(--plum-bg) 70%, transparent);
}
.client-table :deep(tbody tr.is-selected .pin) {
  background: color-mix(in srgb, var(--plum-bg) 70%, var(--panel));
}
</style>
