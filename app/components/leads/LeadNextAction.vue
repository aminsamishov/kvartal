<script setup lang="ts">
import type { Lead } from '~/types/models'
import { LEAD_TASK_KIND_META } from '~/utils/meta'
import { fmtDateTime } from '~/utils/format'

// Самый важный блок карточки: что менеджер должен сделать прямо сейчас.
const props = defineProps<{ lead: Lead }>()

const salesStore = useSalesStore()
const settingsStore = useSettingsStore()
const auth = useAuthStore()
const ui = useUiStore()

const author = computed(() => auth.user?.name ?? 'Система')
const open = computed(() => [...props.lead.tasks].filter((t) => !t.done).sort((a, b) => a.dueAt.localeCompare(b.dueAt)))
const next = computed(() => open.value[0])
const rest = computed(() => open.value.slice(1))
const closed = computed(() => props.lead.stage === 'deal' || props.lead.stage === 'lost')

const showForm = ref(false)
const showRest = ref(false)
const completing = ref(false)
const result = ref('')

const state = computed(() => {
  if (!next.value) return 'none'
  const diff = new Date(next.value.dueAt).getTime() - Date.now()
  if (diff < 0) return 'overdue'
  if (diff < 86400000 && new Date(next.value.dueAt).toDateString() === new Date().toDateString()) return 'today'
  return 'planned'
})

const TONE = {
  overdue: { wrap: 'border-bad bg-bad-bg', label: 'Просрочено', text: 'text-bad', icon: 'ph:warning-circle' },
  today: { wrap: 'border-warn bg-warn-bg', label: 'Сегодня', text: 'text-warn', icon: 'ph:calendar-dot' },
  planned: { wrap: 'border-line bg-panel', label: 'Запланировано', text: 'text-muted', icon: 'ph:calendar-blank' },
  none: { wrap: 'border-dashed border-line bg-panel', label: '', text: 'text-muted', icon: 'ph:question' },
} as const

const overdueBy = computed(() => {
  if (state.value !== 'overdue' || !next.value) return ''
  const days = Math.floor((Date.now() - new Date(next.value.dueAt).getTime()) / 86400000)
  return days >= 1 ? ` на ${days} дн.` : ''
})

const RESULTS = ['Дозвонился', 'Не ответил', 'Просил перезвонить', 'Отправил материалы']

function complete() {
  if (!next.value) return
  salesStore.completeLeadTask(props.lead.id, next.value.id, result.value, author.value)
  ui.toast('Задача выполнена', 'ok')
  completing.value = false
  result.value = ''
}
function postpone(days: number) {
  if (!next.value) return
  salesStore.rescheduleLeadTask(props.lead.id, next.value.id, days, author.value)
  ui.toast(days === 1 ? 'Перенесено на завтра' : `Перенесено на ${days} дн.`, 'info')
}
function assignee(id: string) {
  return settingsStore.users.find((u) => u.id === id)?.name ?? '—'
}
</script>

<template>
  <AppCard id="sec-action" :padded="false">
    <div class="flex items-center justify-between gap-3 px-4 pt-4">
      <h3 class="text-[13px] font-semibold uppercase tracking-[0.04em] text-muted">Следующее действие</h3>
      <AppButton size="sm" icon="ph:plus" @click="showForm = !showForm">Задача</AppButton>
    </div>

    <div class="p-4">
      <div v-if="showForm" class="mb-3">
        <TaskComposer :lead-id="lead.id" @done="showForm = false" @cancel="showForm = false" />
      </div>

      <!-- активная задача -->
      <div v-if="next" class="rounded-xl2 border p-3" :class="TONE[state].wrap">
        <p class="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.04em]" :class="TONE[state].text">
          <Icon :name="TONE[state].icon" size="13" /> {{ TONE[state].label }}{{ overdueBy }}
        </p>
        <div class="mt-2 flex items-start gap-2.5">
          <Icon :name="LEAD_TASK_KIND_META[next.kind].icon" size="18" class="mt-0.5 shrink-0 text-muted" />
          <div class="min-w-0 flex-1">
            <p class="text-[14px] font-semibold leading-snug text-ink">{{ next.title }}</p>
            <p class="mt-0.5 text-[12px] text-muted">
              {{ fmtDateTime(next.dueAt) }} · {{ assignee(next.assignedTo) }}
              <span v-if="next.rescheduledFrom" class="text-warn"> · перенесена</span>
            </p>
          </div>
        </div>

        <!-- выполнение с итогом -->
        <div v-if="completing" class="mt-3 rounded-lg border border-line bg-panel p-2.5">
          <p class="mb-1.5 text-[11.5px] font-medium text-muted">Чем закончилось?</p>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="r in RESULTS" :key="r" type="button"
              class="focus-ring rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors"
              :class="result === r ? 'border-ink bg-ink text-panel' : 'border-line text-muted hover:text-ink'"
              @click="result = r"
            >{{ r }}</button>
          </div>
          <div class="mt-2 flex gap-2">
            <AppButton size="sm" block @click="completing = false">Отмена</AppButton>
            <AppButton size="sm" block variant="primary" icon="ph:check-bold" @click="complete">Готово</AppButton>
          </div>
        </div>

        <div v-else class="mt-3 flex flex-wrap gap-1.5">
          <AppButton size="sm" variant="primary" icon="ph:check-bold" @click="completing = true">Выполнить</AppButton>
          <AppButton size="sm" icon="ph:clock-clockwise" @click="postpone(1)">На завтра</AppButton>
          <AppButton size="sm" @click="postpone(3)">+3 дня</AppButton>
          <AppButton size="sm" @click="postpone(7)">+неделя</AppButton>
        </div>
      </div>

      <!-- задачи нет -->
      <div v-else-if="!closed" class="rounded-xl2 border border-dashed border-warn bg-warn-bg p-3">
        <p class="flex items-center gap-1.5 text-[13px] font-semibold text-warn">
          <Icon name="ph:warning-circle" size="15" /> Следующий шаг не назначен
        </p>
        <p class="mt-1 text-[12px] text-muted">Заявка без задачи теряется — поставьте шаг, чтобы она не зависла.</p>
        <AppButton size="sm" variant="primary" icon="ph:plus" class="mt-2.5" @click="showForm = true">Поставить задачу</AppButton>
      </div>

      <p v-else class="rounded-xl2 bg-soft px-3 py-2.5 text-[12.5px] text-muted">
        Заявка закрыта — активные задачи не требуются.
      </p>

      <!-- остальные открытые -->
      <div v-if="rest.length" class="mt-2.5">
        <button class="flex items-center gap-1 text-[12px] font-medium text-muted hover:text-ink" @click="showRest = !showRest">
          <Icon :name="showRest ? 'ph:caret-up' : 'ph:caret-down'" size="12" /> Ещё {{ rest.length }} открытых
        </button>
        <div v-if="showRest" class="mt-2 flex flex-col gap-1.5">
          <div v-for="t in rest" :key="t.id" class="flex items-center gap-2 rounded-lg border border-line px-2.5 py-1.5">
            <Icon :name="LEAD_TASK_KIND_META[t.kind].icon" size="13" class="shrink-0 text-muted" />
            <span class="min-w-0 flex-1 truncate text-[12.5px]">{{ t.title }}</span>
            <span class="shrink-0 text-[11.5px] text-muted">{{ fmtDateTime(t.dueAt) }}</span>
            <button class="shrink-0 text-muted hover:text-bad" title="Удалить" @click="salesStore.removeLeadTask(lead.id, t.id)">
              <Icon name="ph:x" size="12" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </AppCard>
</template>
