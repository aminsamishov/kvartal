<script setup lang="ts">
import type { Lead } from '~/types/models'
import { buildLeadTimeline, type TimelineGroup } from '~/utils/leadTimeline'
import { fmtDateTime } from '~/utils/format'

const props = defineProps<{ lead: Lead }>()

const salesStore = useSalesStore()
const unitsStore = useUnitsStore()
const dealsStore = useDealsStore()
const auth = useAuthStore()
const ui = useUiStore()

const FILTERS: { value: TimelineGroup | ''; label: string }[] = [
  { value: '', label: 'Всё' },
  { value: 'comm', label: 'Контакты' },
  { value: 'stage', label: 'Этапы' },
  { value: 'task', label: 'Задачи' },
  { value: 'money', label: 'Деньги' },
]
const filter = ref<TimelineGroup | ''>('')
const limit = ref(12)

const contracts = computed(() => dealsStore.contractsForLead(props.lead.id))
const payments = computed(() => contracts.value.flatMap((c) => dealsStore.paymentsFor(c.id)))

const items = computed(() => buildLeadTimeline({
  lead: props.lead,
  reservations: salesStore.reservationsForLead(props.lead.id),
  contracts: contracts.value,
  payments: payments.value,
  unitOf: (id) => unitsStore.unit(id),
}))

const filtered = computed(() => (filter.value ? items.value.filter((i) => i.group === filter.value) : items.value))
const shown = computed(() => filtered.value.slice(0, limit.value))

const TONE = {
  ok: 'text-ok', warn: 'text-warn', bad: 'text-bad', plum: 'text-plum', neutral: 'text-muted',
} as const

// быстрая фиксация контакта — без неё лента наполняется только системными событиями
const noteText = ref('')
function addNote() {
  if (!noteText.value.trim()) return
  salesStore.addLeadNote(props.lead.id, noteText.value, auth.user?.name ?? 'Система')
  noteText.value = ''
  ui.toast('Заметка добавлена', 'ok')
}
</script>

<template>
  <AppCard :padded="false">
    <div class="flex flex-wrap items-center justify-between gap-2 px-4 pt-4">
      <h3 class="text-[13px] font-semibold uppercase tracking-[0.04em] text-muted">История клиента</h3>
      <div class="flex gap-1">
        <button
          v-for="f in FILTERS" :key="f.label" type="button"
          class="focus-ring rounded-lg px-2 py-1 text-[11.5px] font-medium transition-colors"
          :class="filter === f.value ? 'bg-soft text-ink' : 'text-muted hover:text-ink'"
          @click="filter = f.value"
        >{{ f.label }}</button>
      </div>
    </div>

    <div class="p-4">
      <!-- быстрая заметка -->
      <div class="mb-3 flex gap-2">
        <input
          v-model="noteText" placeholder="Записать результат разговора…"
          class="focus-ring h-9 min-w-0 flex-1 rounded-xl2 border border-line bg-panel px-3 text-[12.5px] text-ink placeholder:text-muted/70"
          @keydown.enter="addNote"
        >
        <AppButton size="sm" icon="ph:paper-plane-right" :disabled="!noteText.trim()" @click="addNote" />
      </div>

      <div v-if="shown.length" class="relative flex flex-col gap-3 pl-6">
        <span class="absolute inset-y-1 left-[9px] w-px bg-line" />
        <div v-for="item in shown" :key="item.id" class="relative">
          <span
            class="absolute -left-6 top-0 grid h-[19px] w-[19px] place-items-center rounded-full border border-line bg-panel"
            :class="TONE[item.tone ?? 'neutral']"
          >
            <Icon :name="item.icon" size="11" />
          </span>
          <p class="text-[12.5px] leading-snug text-ink">{{ item.title }}</p>
          <p v-if="item.detail" class="mt-0.5 text-[12px] text-muted">{{ item.detail }}</p>
          <p class="mt-0.5 text-[11px] text-muted">
            {{ fmtDateTime(item.at) }}<template v-if="item.author"> · {{ item.author }}</template>
          </p>
        </div>

        <button
          v-if="filtered.length > limit" type="button"
          class="focus-ring mt-1 rounded-xl2 border border-dashed border-line py-1.5 text-[12px] font-medium text-muted hover:border-plum hover:text-plum"
          @click="limit += 20"
        >Показать ещё {{ filtered.length - limit }}</button>
      </div>

      <EmptyState v-else compact icon="ph:clock-counter-clockwise" title="Событий нет" />
    </div>
  </AppCard>
</template>
