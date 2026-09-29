<script setup lang="ts">
import * as XLSX from 'xlsx'
import { CLIENT_COLUMNS, clientCellText, type ClientColumnKey } from '~/utils/clientColumns'
import { emptyClientFilters, matchesClientFilters, type ClientFilterState } from '~/utils/clientFilters'
import { CLIENT_STATUS_META, type ClientProfile } from '~/utils/clientProfile'
import { money, moneyCompact, pluralRu } from '~/utils/format'
import type { MetricItem } from '~/components/dashboard/MetricStrip.vue'
import type { ContextAction } from '~/components/ui/ContextMenu.vue'

definePageMeta({ breadcrumb: [{ label: 'Продажи' }, { label: 'Клиенты' }] })

/**
 * Реестр покупателей. Данные не хранятся отдельно: профиль клиента собирается
 * из заявок, броней, договоров, графиков, платежей и документов — поэтому
 * цифры здесь всегда те же, что в договоре.
 */
const { profiles, profile } = useClientProfiles()
const salesStore = useSalesStore()
const ui = useUiStore()

/* -------------------------------- фильтры -------------------------------- */

const filters = ref<ClientFilterState>(emptyClientFilters())
const visible = computed(() => profiles.value.filter((p) => matchesClientFilters(p, filters.value)))

/* -------------------------------- колонки -------------------------------- */

const DEFAULT_COLUMNS: ClientColumnKey[] = CLIENT_COLUMNS.map((c) => c.key)
const COLUMNS_KEY = 'inhouse:clients:columns'

const visibleKeys = ref<ClientColumnKey[]>([...DEFAULT_COLUMNS])
const columnsOpen = ref(false)
const columnsRoot = ref<HTMLElement | null>(null)
onClickOutside(columnsRoot, () => (columnsOpen.value = false))

onMounted(() => {
  try {
    const raw = localStorage.getItem(COLUMNS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as ClientColumnKey[]
      const known = parsed.filter((k) => DEFAULT_COLUMNS.includes(k))
      if (known.length) visibleKeys.value = known
    }
  } catch {
    // настройки колонок — удобство, а не данные: молча остаёмся на умолчании
  }
})

watch(visibleKeys, (v) => {
  try {
    localStorage.setItem(COLUMNS_KEY, JSON.stringify(v))
  } catch {
    // приватный режим — таблица работает и без памяти
  }
}, { deep: true })

function toggleColumn(key: ClientColumnKey) {
  visibleKeys.value = visibleKeys.value.includes(key)
    ? visibleKeys.value.filter((k) => k !== key)
    : [...visibleKeys.value, key]
}

/* -------------------------- сортировка и выделение ------------------------ */

const sortKey = ref<ClientColumnKey>('purchaseAt')
const sortDir = ref<1 | -1>(-1)

function onSort(key: ClientColumnKey) {
  if (sortKey.value === key) sortDir.value = sortDir.value === 1 ? -1 : 1
  else {
    sortKey.value = key
    // деньги и даты интереснее по убыванию, имена — по алфавиту
    sortDir.value = ['client', 'phone', 'project', 'manager', 'contract', 'status'].includes(key) ? 1 : -1
  }
}

const selected = ref<string[]>([])
const selectedProfiles = computed(() => visible.value.filter((p) => selected.value.includes(p.client.id)))
const selectionTotals = computed(() => ({
  purchases: selectedProfiles.value.reduce((s, p) => s + p.totals.purchases, 0),
  paid: selectedProfiles.value.reduce((s, p) => s + p.totals.paid, 0),
  remaining: selectedProfiles.value.reduce((s, p) => s + p.totals.remaining, 0),
}))

// строки, выпавшие из фильтра, не должны оставаться в выделении
watch(visible, (rows) => {
  const ids = new Set(rows.map((p) => p.client.id))
  selected.value = selected.value.filter((id) => ids.has(id))
})

/* -------------------------------- показатели ------------------------------ */

const metrics = computed<MetricItem[]>(() => {
  const rows = visible.value
  const purchases = rows.reduce((s, p) => s + p.totals.purchases, 0)
  const paid = rows.reduce((s, p) => s + p.totals.paid, 0)
  const overdue = rows.filter((p) => p.totals.overdueAmount)
  const units = rows.reduce((s, p) => s + p.totals.unitsCount, 0)
  return [
    {
      key: 'ltv', label: 'Объём покупок', hero: true, value: moneyCompact(purchases), unit: 'USD',
      hint: `${rows.length} ${pluralRu(rows.length, 'клиент', 'клиента', 'клиентов')} · ${units} ${pluralRu(units, 'объект', 'объекта', 'объектов')}`,
      meter: { pct: purchases ? Math.round((paid / purchases) * 100) : 0, caption: 'оплачено' },
    },
    { key: 'paid', label: 'Оплачено', value: moneyCompact(paid), tone: 'ok', hint: `${purchases ? Math.round((paid / purchases) * 100) : 0}% от объёма` },
    { key: 'rest', label: 'Остаток к оплате', value: moneyCompact(purchases - paid), hint: 'по действующим графикам' },
    {
      key: 'overdue', label: 'С просрочкой', value: String(overdue.length), tone: 'bad',
      hint: overdue.length ? moneyCompact(overdue.reduce((s, p) => s + p.totals.overdueAmount, 0)) : 'все платят в срок',
    },
    {
      key: 'vip', label: 'VIP-клиенты', value: String(rows.filter((p) => p.client.vip).length),
      hint: 'повторные и крупные покупки',
    },
  ]
})

/* --------------------------------- экспорт -------------------------------- */

function exportRows(only?: ClientProfile[]) {
  const rows = only?.length ? only : selectedProfiles.value.length ? selectedProfiles.value : visible.value
  if (!rows.length) { ui.toast('Нечего выгружать', 'warn'); return }
  const columns = CLIENT_COLUMNS.filter((c) => c.required || visibleKeys.value.includes(c.key))
  const data = rows.map((p) => Object.fromEntries(columns.map((c) => [c.label, clientCellText(p, c.key)])))
  const sheet = XLSX.utils.json_to_sheet(data)
  sheet['!cols'] = columns.map((c) => ({ wch: Math.max(12, Math.round(Number.parseInt(c.width ?? '140', 10) / 8)) }))
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, 'Клиенты')
  XLSX.writeFile(book, 'клиенты.xlsx')
  ui.toast(`Выгружено клиентов: ${rows.length}`, 'ok')
}

/* ----------------------------- контекстное меню --------------------------- */

/** Правый клик по строке: действия, ради которых иначе открывают досье. */
const menu = useContextMenu<string>()
const menuProfile = computed(() => profile(menu.row.value ?? undefined))

const menuActions = computed<ContextAction[]>(() => {
  const p = menuProfile.value
  return [
    { key: 'open', label: 'Открыть досье', icon: 'ph:arrow-square-out', hint: '↵' },
    { key: 'call', label: 'Позвонить', icon: 'ph:phone', disabled: !p?.client.phone },
    { key: 'whatsapp', label: 'Написать в WhatsApp', icon: 'ph:whatsapp-logo', disabled: !(p?.client.whatsapp || p?.client.phone) },
    { key: 'contract', label: 'Открыть договор', icon: 'ph:file-text', disabled: !p?.contracts.length, separated: true },
    { key: 'unit', label: 'Открыть помещение', icon: 'ph:grid-nine', disabled: !p?.units.length },
    { key: 'select', label: selected.value.includes(menu.row.value ?? '') ? 'Убрать из выделения' : 'Добавить к выделению', icon: 'ph:check-square', separated: true },
    { key: 'export', label: 'Выгрузить строку в Excel', icon: 'ph:file-xls' },
  ]
})

function onMenuPick(key: string) {
  const p = menuProfile.value
  if (!p) return
  if (key === 'open') activeId.value = p.client.id
  if (key === 'call' && p.client.phone) window.open(`tel:+${p.client.phone}`)
  if (key === 'whatsapp') window.open(`https://wa.me/${(p.client.whatsapp || p.client.phone).replace(/\D/g, '')}`, '_blank')
  if (key === 'contract' && p.contracts[0]) navigateTo(`/contracts/${p.contracts[0].id}`)
  if (key === 'unit' && p.units[0]) activeUnitId.value = p.units[0].id
  if (key === 'select') {
    selected.value = selected.value.includes(p.client.id)
      ? selected.value.filter((x) => x !== p.client.id)
      : [...selected.value, p.client.id]
  }
  if (key === 'export') exportRows([p])
}

/* --------------------------------- карточка ------------------------------- */

const activeId = ref<string | null>(null)
const activeProfile = computed(() => profile(activeId.value) ?? null)
const activeUnitId = ref<string | null>(null)

/* ------------------------------- новый клиент ----------------------------- */

const createOpen = ref(false)
const form = reactive({ name: '', phone: '', kind: 'person' as 'person' | 'company', inn: '', email: '' })

async function createClient() {
  if (!form.name.trim() || !form.phone.trim()) { ui.toast('Укажите имя и телефон', 'warn'); return }
  const client = await salesStore.addClient({
    kind: form.kind, name: form.name.trim(), phone: form.phone.replace(/\D/g, ''),
    origin: 'own', email: form.email.trim() || undefined, inn: form.inn.trim() || undefined,
  })
  ui.toast('Клиент добавлен', 'ok')
  createOpen.value = false
  form.name = ''; form.phone = ''; form.inn = ''; form.email = ''
  filters.value = { ...filters.value, buyersOnly: false }
  activeId.value = client.id
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <PageHeader
      title="Клиенты"
      :subtitle="`Покупатели с договорами · ${visible.length} из ${profiles.length} карточек`"
    >
      <template #actions>
        <div ref="columnsRoot" class="relative">
          <AppButton icon="ph:columns" @click="columnsOpen = !columnsOpen">
            Колонки
            <span class="tabular text-muted">{{ visibleKeys.length }}</span>
          </AppButton>
          <Transition enter-active-class="animate-pop-in">
            <div v-if="columnsOpen" class="absolute right-0 top-11 z-30 w-[240px] rounded-card border border-line bg-panel p-2 shadow-panel">
              <p class="px-2 pb-1.5 pt-1 text-[11px] uppercase tracking-[0.04em] text-muted">Показывать колонки</p>
              <label
                v-for="col in CLIENT_COLUMNS" :key="col.key"
                class="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[12.5px] hover:bg-soft"
                :class="col.required ? 'opacity-60' : ''"
              >
                <input
                  type="checkbox" class="accent-plum"
                  :checked="col.required || visibleKeys.includes(col.key)"
                  :disabled="col.required"
                  @change="toggleColumn(col.key)"
                >
                {{ col.label }}
                <Icon v-if="col.required" name="ph:push-pin-fill" size="11" class="ml-auto text-muted" title="Закреплена" />
              </label>
              <button
                class="focus-ring mt-1 w-full rounded-lg border border-line py-1.5 text-[12px] font-medium text-muted hover:text-ink"
                @click="visibleKeys = [...DEFAULT_COLUMNS]"
              >Показать все</button>
            </div>
          </Transition>
        </div>

        <AppButton icon="ph:file-xls" @click="exportRows()">
          Excel<span v-if="selected.length" class="tabular text-muted">· {{ selected.length }}</span>
        </AppButton>
        <AppButton variant="primary" icon="ph:plus-bold" @click="createOpen = true">Новый клиент</AppButton>
      </template>
    </PageHeader>

    <MetricStrip :items="metrics" />

    <ClientFilterBar v-model="filters" :profiles="profiles" :matched="visible.length" />

    <ClientsTable
      :profiles="visible" :visible-keys="visibleKeys" :selected="selected"
      :sort-key="sortKey" :sort-dir="sortDir"
      @open="activeId = $event" @sort="onSort" @update:selected="selected = $event"
      @context="menu.open($event.event, $event.id)"
    />

    <ContextMenu
      :x="menu.x.value" :y="menu.y.value" :actions="menuActions"
      :title="menuProfile?.client.name" @pick="onMenuPick" @close="menu.close()"
    />

    <!-- массовое выделение -->
    <Transition
      enter-active-class="transition-all duration-200" leave-active-class="transition-all duration-150"
      enter-from-class="translate-y-4 opacity-0" leave-to-class="translate-y-4 opacity-0"
    >
      <div
        v-if="selected.length"
        class="sticky bottom-3 z-30 flex flex-wrap items-center gap-3 rounded-card border border-ink bg-panel/95 px-3 py-2.5 shadow-pop backdrop-blur"
      >
        <span class="tabular grid h-7 min-w-7 place-items-center rounded-lg bg-ink px-1.5 text-[13px] font-bold text-panel">{{ selected.length }}</span>
        <div class="text-[12px] leading-tight">
          <p class="tabular font-semibold text-ink">{{ money(selectionTotals.purchases) }}</p>
          <p class="tabular text-muted">
            оплачено {{ money(selectionTotals.paid) }} · остаток {{ money(selectionTotals.remaining) }}
          </p>
        </div>
        <span class="h-6 w-px bg-line" />
        <AppButton size="sm" icon="ph:file-xls" @click="exportRows()">Выгрузить выбранных</AppButton>
        <button class="ml-auto text-[12px] font-semibold text-muted hover:text-bad" @click="selected = []">Снять выделение</button>
      </div>
    </Transition>

    <ClientDrawer :profile="activeProfile" @close="activeId = null" @open-unit="activeUnitId = $event" />
    <UnitDrawer :unit-id="activeUnitId" @close="activeUnitId = null" @navigate="activeUnitId = $event" />

    <!-- новый клиент -->
    <AppModal v-model="createOpen" title="Новый клиент" width="sm">
      <div class="flex flex-col gap-3.5">
        <AppSelect v-model="form.kind" label="Тип" :options="[{ value: 'person', label: 'Физлицо' }, { value: 'company', label: 'Юрлицо' }]" />
        <AppInput v-model="form.name" :label="form.kind === 'person' ? 'ФИО' : 'Название организации'" />
        <AppInput v-model="form.phone" label="Телефон" placeholder="+996 700 000 000" />
        <div class="grid grid-cols-2 gap-3">
          <AppInput v-model="form.inn" label="ИНН" />
          <AppInput v-model="form.email" label="Почта" />
        </div>
        <p class="rounded-xl2 bg-soft px-3 py-2 text-[11.5px] text-muted">
          Покупки, договоры и платежи подтянутся в карточку сами — заполнять их здесь не нужно.
        </p>
        <div class="flex gap-2">
          <AppButton block @click="createOpen = false">Отмена</AppButton>
          <AppButton block variant="primary" icon="ph:check-bold" @click="createClient">Добавить</AppButton>
        </div>
      </div>
    </AppModal>
  </div>
</template>
