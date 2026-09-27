<script setup lang="ts">
import type { ClientProfile } from '~/utils/clientProfile'
import { buildClientTimeline } from '~/utils/clientTimeline'
import type { TimelineGroup } from '~/utils/leadTimeline'
import { fmtDateTime } from '~/utils/format'

/**
 * История клиента одной лентой: заявки, показы, звонки, переписка, брони,
 * договоры, платежи и документы. Отдельные ленты по разделам заставляли
 * менеджера собирать картину из четырёх экранов.
 */
const props = defineProps<{ profile: ClientProfile }>()

const unitsStore = useUnitsStore()
const salesStore = useSalesStore()
const auth = useAuthStore()
const ui = useUiStore()

const FILTERS: { value: TimelineGroup | ''; label: string }[] = [
  { value: '', label: 'Всё' },
  { value: 'comm', label: 'Контакты' },
  { value: 'stage', label: 'Заявки' },
  { value: 'task', label: 'Задачи' },
  { value: 'object', label: 'Брони' },
  { value: 'money', label: 'Деньги' },
  { value: 'doc', label: 'Документы' },
  { value: 'note', label: 'Заметки' },
]

const filter = ref<TimelineGroup | ''>('')
const limit = ref(20)

const items = computed(() => buildClientTimeline(props.profile, (id) => unitsStore.unit(id)))
const filtered = computed(() => (filter.value ? items.value.filter((i) => i.group === filter.value) : items.value))
const shown = computed(() => filtered.value.slice(0, limit.value))

const TONE = { ok: 'text-ok', warn: 'text-warn', bad: 'text-bad', plum: 'text-plum', neutral: 'text-muted' } as const

/** Комментарий пишем в последнюю живую заявку — заметки живут там. */
const noteTarget = computed(() => [...props.profile.leads]
  .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0])

const noteText = ref('')
function addNote() {
  if (!noteText.value.trim()) return
  if (!noteTarget.value) { ui.toast('Заметку некуда записать — у клиента нет заявок', 'warn'); return }
  salesStore.addLeadNote(noteTarget.value.id, noteText.value, auth.user?.name ?? 'Система')
  noteText.value = ''
  ui.toast('Комментарий добавлен', 'ok')
}
</script>

<template>
  <AppCard :padded="false">
    <div class="flex flex-wrap items-center justify-between gap-2 px-4 pt-4">
      <h3 class="text-[13px] font-semibold uppercase tracking-[0.04em] text-muted">
        История
        <span class="tabular ml-1 rounded-full bg-soft px-1.5 py-0.5 text-[11px] text-ink">{{ items.length }}</span>
      </h3>
      <div class="flex flex-wrap gap-1">
        <button
          v-for="f in FILTERS" :key="f.label" type="button"
          class="focus-ring rounded-lg px-2 py-1 text-[11.5px] font-medium transition-colors"
          :class="filter === f.value ? 'bg-soft text-ink' : 'text-muted hover:text-ink'"
          @click="filter = f.value"
        >{{ f.label }}</button>
      </div>
    </div>

    <div class="p-4">
      <div class="mb-3 flex gap-2">
        <input
          v-model="noteText" placeholder="Комментарий по клиенту…"
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
          @click="limit += 30"
        >Показать ещё {{ filtered.length - limit }}</button>
      </div>

      <EmptyState v-else compact icon="ph:clock-counter-clockwise" title="Событий нет" />
    </div>
  </AppCard>
</template>
