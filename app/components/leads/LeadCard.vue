<script setup lang="ts">
import type { Lead } from '~/types/models'
import { LEAD_CHANNEL_ICON, LEAD_PRIORITY_META, LEAD_TASK_KIND_META } from '~/utils/meta'
import { fmtDate, fmtPhone, money } from '~/utils/format'

const props = defineProps<{ lead: Lead }>()
const emit = defineEmits<{ open: [string] }>()

const salesStore = useSalesStore()
const unitsStore = useUnitsStore()
const settingsStore = useSettingsStore()
const { draggingId, start, end } = useLeadDnd()

const client = computed(() => salesStore.client(props.lead.clientId))
const manager = computed(() => settingsStore.users.find((u) => u.id === props.lead.assignedTo))
const task = computed(() => salesStore.openTask(props.lead))
const state = computed(() => salesStore.taskState(props.lead))
const days = computed(() => salesStore.daysInStage(props.lead))
const units = computed(() => props.lead.interestedUnitIds.map((id) => unitsStore.unit(id)).filter(Boolean))

// цвет строки задачи — главный сигнал на доске: просрочено / сегодня / план
const TASK_TONE = {
  overdue: 'bg-bad-bg text-bad',
  today: 'bg-warn-bg text-warn',
  planned: 'bg-soft text-muted',
  none: 'bg-soft text-muted',
} as const

function taskLabel() {
  if (!task.value) return 'Задачи нет'
  const d = new Date(task.value.dueAt)
  const diff = Math.floor((d.getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000)
  if (state.value === 'overdue') return `Просрочено · ${fmtDate(task.value.dueAt)}`
  if (diff === 0) return 'Сегодня'
  if (diff === 1) return 'Завтра'
  return fmtDate(task.value.dueAt)
}

// «висит долго» считаем только для активных этапов: у сделки и отказа
// счётчик простоя смысла не имеет
const stale = computed(() => days.value >= 7 && props.lead.stage !== 'deal' && props.lead.stage !== 'lost')
</script>

<template>
  <article
    draggable="true"
    class="group cursor-pointer select-none rounded-xl2 border border-line bg-panel p-2.5 shadow-card transition-all hover:-translate-y-px hover:border-plum/40 hover:shadow-rise"
    :class="draggingId === lead.id ? 'opacity-40' : ''"
    @dragstart="start(lead.id, lead.stage)"
    @dragend="end"
    @click="emit('open', lead.id)"
  >
    <!-- шапка: приоритет, клиент, бюджет -->
    <div class="flex items-start gap-2">
      <span
        v-if="lead.priority !== 'normal'" class="mt-1 h-2 w-2 shrink-0 rounded-full"
        :style="{ background: LEAD_PRIORITY_META[lead.priority].color }"
        :title="`Приоритет: ${LEAD_PRIORITY_META[lead.priority].label}`"
      />
      <p class="min-w-0 flex-1 truncate text-[13px] font-semibold leading-tight text-ink">{{ client?.name ?? 'Без клиента' }}</p>
      <span v-if="lead.budget" class="tabular shrink-0 text-[12.5px] font-semibold text-ink">{{ money(lead.budget) }}</span>
    </div>

    <p class="mt-1 flex items-center gap-1.5 text-[11.5px] text-muted">
      <Icon :name="LEAD_CHANNEL_ICON[lead.channel] ?? 'ph:chat-circle'" size="12" class="shrink-0" />
      <span class="truncate">{{ client?.phone ? fmtPhone(client.phone) : lead.channel }}</span>
    </p>

    <!-- теги -->
    <div v-if="lead.tags.length" class="mt-2 flex flex-wrap gap-1">
      <span v-for="t in lead.tags.slice(0, 2)" :key="t" class="rounded bg-plum-soft px-1.5 py-0.5 text-[10.5px] font-medium text-plum">{{ t }}</span>
      <span v-if="lead.tags.length > 2" class="rounded bg-soft px-1.5 py-0.5 text-[10.5px] font-medium text-muted">+{{ lead.tags.length - 2 }}</span>
    </div>

    <!-- интерес к объектам -->
    <p v-if="units.length" class="mt-2 flex items-center gap-1 truncate text-[11px] text-muted">
      <Icon name="ph:door" size="12" class="shrink-0" />
      <span class="truncate">{{ units.map((u) => `№ ${u!.number}`).join(', ') }}</span>
    </p>

    <!-- причина отказа вместо задачи -->
    <p v-if="lead.stage === 'lost' && lead.lostReason" class="mt-2 flex items-center gap-1.5 rounded-lg bg-bad-bg px-2 py-1 text-[11px] font-medium text-bad">
      <Icon name="ph:prohibit" size="12" class="shrink-0" /> <span class="truncate">{{ lead.lostReason }}</span>
    </p>

    <!-- ближайшая задача -->
    <p
      v-else-if="lead.stage !== 'deal'"
      class="mt-2 flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium"
      :class="TASK_TONE[state]"
    >
      <Icon :name="task ? LEAD_TASK_KIND_META[task.kind].icon : 'ph:warning-circle'" size="12" class="shrink-0" />
      <span class="truncate">{{ task ? task.title : 'Задачи нет' }}</span>
      <span class="ml-auto shrink-0 whitespace-nowrap">{{ task ? taskLabel() : '' }}</span>
    </p>

    <!-- подвал -->
    <div class="mt-2.5 flex items-center gap-2 border-t border-line pt-2">
      <AppAvatar v-if="manager" :name="manager.name" :color="manager.avatarColor" size="sm" />
      <span class="min-w-0 flex-1 truncate text-[11px] text-muted">{{ lead.source }}</span>
      <span
        class="tabular flex shrink-0 items-center gap-1 text-[11px]"
        :class="stale ? 'font-semibold text-warn' : 'text-muted'"
        :title="`На этапе с ${fmtDate(lead.stageSince)}`"
      >
        <Icon name="ph:clock-countdown" size="12" /> {{ days }} д.
      </span>
    </div>
  </article>
</template>
