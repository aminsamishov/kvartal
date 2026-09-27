<script setup lang="ts">
import type { Lead, LeadPriority, LeadStage } from '~/types/models'
import { LEAD_CHANNEL_ICON, LEAD_PIPELINE, LEAD_STAGES, LEAD_STAGE_META, LEAD_TAGS } from '~/utils/meta'
import { moneyCompact } from '~/utils/format'
import { LEAD_SOURCES } from '~/data/names'
import type { MetricItem } from '~/components/dashboard/MetricStrip.vue'

definePageMeta({ breadcrumb: [{ label: 'Продажи' }, { label: 'Заявки' }] })

const salesStore = useSalesStore()
const settingsStore = useSettingsStore()
const misc = useMiscStore()
const auth = useAuthStore()
const ui = useUiStore()

const author = computed(() => auth.user?.name ?? 'Система')
const view = ref<'board' | 'table'>('board')

/* --------------------------------- фильтры -------------------------------- */

const filters = reactive({
  search: '',
  assignedTo: '',
  source: '',
  tag: '',
  task: '' as '' | 'overdue' | 'today' | 'none',
  mine: false,
})
const filtersOpen = ref(false)

const activeFilterCount = computed(() =>
  [filters.assignedTo, filters.source, filters.tag, filters.task].filter(Boolean).length + (filters.mine ? 1 : 0))

function resetFilters() {
  filters.assignedTo = ''
  filters.source = ''
  filters.tag = ''
  filters.task = ''
  filters.mine = false
}

const managers = computed(() => settingsStore.users.filter((u) => u.active && ['manager', 'commercial_director', 'director'].includes(u.role)))

const filtered = computed(() => salesStore.leads.filter((l) => {
  if (filters.mine && l.assignedTo !== auth.user?.id) return false
  if (filters.assignedTo && l.assignedTo !== filters.assignedTo) return false
  if (filters.source && l.source !== filters.source) return false
  if (filters.tag && !l.tags.includes(filters.tag)) return false
  if (filters.task && salesStore.taskState(l) !== filters.task) return false
  const q = filters.search.trim().toLowerCase()
  if (q) {
    const c = salesStore.client(l.clientId)
    const hit = c?.name.toLowerCase().includes(q) || c?.phone.includes(q.replace(/\D/g, '')) || l.tags.some((t) => t.toLowerCase().includes(q))
    if (!hit) return false
  }
  return true
}))

function leadsFor(stage: LeadStage) {
  // приоритетные и просроченные — наверх колонки: доска читается сверху вниз
  const weight = (l: Lead) => (salesStore.taskState(l) === 'overdue' ? 0 : l.priority === 'high' ? 1 : 2)
  return filtered.value.filter((l) => l.stage === stage)
    .sort((a, b) => weight(a) - weight(b) || b.stageSince.localeCompare(a.stageSince))
}

/** Конверсия этапа к предыдущему — по всей воронке, не по фильтру. */
function conversion(stage: LeadStage) {
  const i = LEAD_PIPELINE.indexOf(stage)
  if (i <= 0) return null
  const prev = salesStore.stageSummary(LEAD_PIPELINE[i - 1]!).count
  if (!prev) return null
  return Math.round((salesStore.stageSummary(stage).count / prev) * 100)
}

/* -------------------------------- показатели ------------------------------ */

const active = computed(() => salesStore.leads.filter((l) => l.stage !== 'lost' && l.stage !== 'deal'))
const overdue = computed(() => active.value.filter((l) => salesStore.taskState(l) === 'overdue'))
const noTask = computed(() => active.value.filter((l) => salesStore.taskState(l) === 'none'))
const pipelineBudget = computed(() => active.value.reduce((s, l) => s + (l.budget || 0), 0))
const winRate = computed(() => {
  const closed = salesStore.leads.filter((l) => l.stage === 'deal' || l.stage === 'lost').length
  const won = salesStore.leads.filter((l) => l.stage === 'deal').length
  return closed ? Math.round((won / closed) * 100) : 0
})

const metrics = computed<MetricItem[]>(() => [
  { key: 'pipe', label: 'Сумма в работе', hero: true, value: moneyCompact(pipelineBudget.value), unit: 'USD', hint: `${active.value.length} активных заявок` },
  { key: 'overdue', label: 'Просроченные задачи', value: String(overdue.value.length), hint: overdue.value.length ? 'требуют звонка сегодня' : 'всё в срок', tone: 'bad' },
  { key: 'notask', label: 'Без задачи', value: String(noTask.value.length), hint: 'заявка без следующего шага' },
  { key: 'win', label: 'Конверсия в сделку', value: `${winRate.value}%`, hint: 'от закрытых заявок' },
])

/* ------------------------------ перенос этапа ----------------------------- */

const lostFor = ref<string | null>(null)
const lostReason = ref('')
const LOST_REASONS = ['Не подошла цена', 'Купил в другом ЖК', 'Не одобрили ипотеку', 'Взял паузу', 'Не отвечает', 'Не устроили сроки']

function onDrop({ leadId, stage }: { leadId: string; stage: LeadStage }) {
  if (stage === 'lost') {
    // отказ без причины не принимаем — иначе аналитика по причинам пустая
    lostFor.value = leadId
    lostReason.value = ''
    return
  }
  const res = salesStore.moveLead(leadId, stage, author.value)
  if (res) {
    const name = salesStore.client(salesStore.lead(leadId)?.clientId ?? '')?.name ?? 'Заявка'
    misc.log('Заявки', `${name}: ${LEAD_STAGE_META[res.from].label} → ${LEAD_STAGE_META[res.to].label}`, author.value)
    ui.toast(`${name} → ${LEAD_STAGE_META[stage].label}`, 'ok')
  }
}

function confirmLost() {
  if (!lostFor.value) return
  salesStore.moveLead(lostFor.value, 'lost', author.value, { lostReason: lostReason.value })
  misc.log('Заявки', `Отказ: ${lostReason.value || 'без причины'}`, author.value)
  ui.toast('Заявка переведена в «Отказ»', 'info')
  lostFor.value = null
  lostReason.value = ''
}

/* ------------------------------- новая заявка ----------------------------- */

const createOpen = ref(false)
const form = reactive({
  name: '', phone: '', source: 'Сайт', channel: 'Сайт',
  budget: 0, priority: 'normal' as LeadPriority, assignedTo: '', tags: [] as string[],
})

function openCreate() {
  form.name = ''
  form.phone = ''
  form.source = 'Сайт'
  form.channel = 'Сайт'
  form.budget = 0
  form.priority = 'normal'
  form.assignedTo = auth.user?.id ?? managers.value[0]?.id ?? ''
  form.tags = []
  createOpen.value = true
}

async function submitCreate() {
  if (!form.name.trim() || !form.phone.trim()) { ui.toast('Укажите имя и телефон', 'warn'); return }
  const phone = form.phone.replace(/\D/g, '')
  const existing = salesStore.clients.find((c) => c.phone === phone)
  const client = existing ?? await salesStore.addClient({ kind: 'person', name: form.name, phone, origin: 'own' })
  const lead = salesStore.createLead({
    clientId: client.id, channel: form.channel, source: form.source,
    assignedTo: form.assignedTo, budget: form.budget, priority: form.priority, tags: [...form.tags],
  }, author.value)
  // задачу «Первый звонок» ставит автоматизация в сторе — здесь её дублировать
  // не нужно, иначе у заявки появляются две одинаковые задачи
  misc.log('Заявки', `Новая заявка: ${form.name}`, author.value)
  ui.toast(existing ? 'Заявка создана для существующего клиента' : 'Заявка и клиент созданы', 'ok')
  createOpen.value = false
  activeLeadId.value = lead.id
}

const activeLeadId = ref<string | null>(null)
</script>

<template>
  <div class="flex flex-col gap-4">
    <PageHeader title="Заявки" :subtitle="`Воронка продаж · ${filtered.length} из ${salesStore.leads.length} заявок`">
      <template #actions>
        <SegmentedControl
          :model-value="view"
          :options="[{ value: 'board', label: 'Канбан', icon: 'ph:kanban' }, { value: 'table', label: 'Таблица', icon: 'ph:table' }]"
          @update:model-value="view = $event as 'board' | 'table'"
        />
        <AppButton variant="primary" icon="ph:plus-bold" @click="openCreate">Новая заявка</AppButton>
      </template>
    </PageHeader>

    <MetricStrip :items="metrics" />

    <!-- панель фильтров -->
    <div class="flex flex-wrap items-center gap-2">
      <AppInput v-model="filters.search" placeholder="Клиент, телефон, тег" icon="ph:magnifying-glass" class="w-[240px]" />
      <Chip :pressed="filters.mine" icon="ph:user" @click="filters.mine = !filters.mine">Мои</Chip>
      <Chip :pressed="filters.task === 'overdue'" icon="ph:warning-circle" @click="filters.task = filters.task === 'overdue' ? '' : 'overdue'">
        Просрочено{{ overdue.length ? ` · ${overdue.length}` : '' }}
      </Chip>
      <Chip :pressed="filters.task === 'today'" icon="ph:calendar-dot" @click="filters.task = filters.task === 'today' ? '' : 'today'">Сегодня</Chip>
      <Chip :pressed="filters.task === 'none'" icon="ph:question" @click="filters.task = filters.task === 'none' ? '' : 'none'">
        Без задачи{{ noTask.length ? ` · ${noTask.length}` : '' }}
      </Chip>
      <Chip :pressed="filtersOpen" icon="ph:sliders-horizontal" @click="filtersOpen = !filtersOpen">
        Ещё{{ activeFilterCount ? ` · ${activeFilterCount}` : '' }}
      </Chip>
      <button v-if="activeFilterCount" class="text-[12px] font-medium text-muted hover:text-bad" @click="resetFilters">Сбросить</button>
    </div>

    <div v-if="filtersOpen" class="grid grid-cols-1 gap-3 rounded-card border border-line bg-panel p-4 shadow-card sm:grid-cols-3">
      <AppSelect
        :model-value="filters.assignedTo" label="Ответственный"
        :options="[{ value: '', label: 'Все' }, ...managers.map((u) => ({ value: u.id, label: u.name }))]"
        @update:model-value="filters.assignedTo = $event"
      />
      <AppSelect
        :model-value="filters.source" label="Источник"
        :options="[{ value: '', label: 'Все' }, ...LEAD_SOURCES.map((v) => ({ value: v, label: v }))]"
        @update:model-value="filters.source = $event"
      />
      <AppSelect
        :model-value="filters.tag" label="Тег"
        :options="[{ value: '', label: 'Все' }, ...LEAD_TAGS.map((v) => ({ value: v, label: v }))]"
        @update:model-value="filters.tag = $event"
      />
    </div>

    <!-- КАНБАН -->
    <div v-if="view === 'board'" class="-mx-1 flex gap-3 overflow-x-auto px-1 pb-3">
      <LeadColumn
        v-for="stage in LEAD_STAGES" :key="stage"
        :stage="stage" :leads="leadsFor(stage)" :conversion="conversion(stage)"
        @drop="onDrop" @open="activeLeadId = $event" @add="openCreate"
      />
    </div>

    <!-- ТАБЛИЦА -->
    <LeadTable v-else :leads="filtered" @open="activeLeadId = $event" />

    <LeadDrawer
      :lead-id="activeLeadId"
      @close="activeLeadId = null"
      @request-lost="lostFor = $event; lostReason = ''"
      @navigate="activeLeadId = $event"
    />

    <!-- причина отказа -->
    <AppModal :model-value="!!lostFor" title="Причина отказа" width="sm" @update:model-value="lostFor = null">
      <p class="text-[12.5px] text-muted">Причина попадает в аналитику — по ней видно, что именно теряет продажи.</p>
      <div class="mt-3 flex flex-wrap gap-1.5">
        <button
          v-for="r in LOST_REASONS" :key="r" type="button"
          class="focus-ring rounded-full border px-2.5 py-1.5 text-[12px] font-medium transition-colors"
          :class="lostReason === r ? 'border-bad bg-bad-bg text-bad' : 'border-line text-muted hover:bg-soft hover:text-ink'"
          @click="lostReason = r"
        >{{ r }}</button>
      </div>
      <AppInput v-model="lostReason" class="mt-3" label="Или своя формулировка" placeholder="Например, переехал в другой город" />
      <div class="mt-4 flex gap-2">
        <AppButton block @click="lostFor = null">Отмена</AppButton>
        <AppButton block variant="danger" icon="ph:prohibit" @click="confirmLost">В «Отказ»</AppButton>
      </div>
    </AppModal>

    <!-- новая заявка -->
    <AppDrawer v-model="createOpen" title="Новая заявка" subtitle="Клиент создастся автоматически, если его ещё нет" width="min(520px, 100vw)">
      <div class="flex flex-col gap-3.5">
        <AppInput v-model="form.name" label="Имя клиента" placeholder="Иванова Айгуль" />
        <AppInput v-model="form.phone" label="Телефон" placeholder="+996 700 000 000" />
        <div class="grid grid-cols-2 gap-3">
          <AppSelect v-model="form.source" label="Источник" :options="LEAD_SOURCES.map((v) => ({ value: v, label: v }))" />
          <AppSelect v-model="form.channel" label="Канал" :options="Object.keys(LEAD_CHANNEL_ICON).map((v) => ({ value: v, label: v }))" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <AppInput v-model.number="form.budget" type="number" label="Бюджет, USD" />
          <AppSelect v-model="form.assignedTo" label="Ответственный" :options="managers.map((u) => ({ value: u.id, label: u.name }))" />
        </div>
        <div>
          <p class="mb-1.5 text-[12.5px] font-medium text-muted">Приоритет</p>
          <div class="flex gap-1.5">
            <Chip v-for="p in (['high', 'normal', 'low'] as LeadPriority[])" :key="p" :pressed="form.priority === p" @click="form.priority = p">
              {{ p === 'high' ? 'Высокий' : p === 'normal' ? 'Обычный' : 'Низкий' }}
            </Chip>
          </div>
        </div>
        <div>
          <p class="mb-1.5 text-[12.5px] font-medium text-muted">Теги</p>
          <div class="flex flex-wrap gap-1.5">
            <Chip
              v-for="t in LEAD_TAGS" :key="t" :pressed="form.tags.includes(t)"
              @click="form.tags = form.tags.includes(t) ? form.tags.filter((x) => x !== t) : [...form.tags, t]"
            >{{ t }}</Chip>
          </div>
        </div>
        <p class="flex items-start gap-1.5 rounded-xl2 bg-soft px-3 py-2 text-[11.5px] text-muted">
          <Icon name="ph:info" size="13" class="mt-0.5 shrink-0" />
          Вместе с заявкой поставим задачу «Первый звонок клиенту» на завтра — чтобы она не зависла без следующего шага.
        </p>
      </div>
      <template #footer>
        <div class="flex gap-2">
          <AppButton block @click="createOpen = false">Отмена</AppButton>
          <AppButton block variant="primary" icon="ph:plus-bold" @click="submitCreate">Создать заявку</AppButton>
        </div>
      </template>
    </AppDrawer>
  </div>
</template>
