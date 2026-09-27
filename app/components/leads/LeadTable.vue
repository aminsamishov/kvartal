<script setup lang="ts">
import type { Lead } from '~/types/models'
import { LEAD_PRIORITY_META, LEAD_STAGE_COLOR, LEAD_STAGE_META } from '~/utils/meta'
import { fmtDate, fmtPhone, money } from '~/utils/format'

defineProps<{ leads: Lead[] }>()
const emit = defineEmits<{ open: [string] }>()

const salesStore = useSalesStore()
const settingsStore = useSettingsStore()

const TASK_TONE = { overdue: 'text-bad', today: 'text-warn', planned: 'text-muted', none: 'text-muted' } as const
</script>

<template>
  <AppCard :padded="false" flush>
    <div class="overflow-x-auto">
      <table class="data-table">
        <thead>
          <tr>
            <th>Клиент</th>
            <th>Этап</th>
            <th class="text-right">Бюджет</th>
            <th>Задача</th>
            <th>Ответственный</th>
            <th>Источник</th>
            <th class="text-right">На этапе</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="lead in leads" :key="lead.id" class="cursor-pointer" @click="emit('open', lead.id)">
            <td>
              <div class="flex items-center gap-2">
                <span
                  v-if="lead.priority !== 'normal'" class="h-2 w-2 shrink-0 rounded-full"
                  :style="{ background: LEAD_PRIORITY_META[lead.priority].color }" :title="LEAD_PRIORITY_META[lead.priority].label"
                />
                <div class="min-w-0">
                  <p class="truncate text-[13px] font-semibold text-ink">{{ salesStore.client(lead.clientId)?.name ?? '—' }}</p>
                  <p class="truncate text-[11.5px] text-muted">{{ salesStore.client(lead.clientId)?.phone ? fmtPhone(salesStore.client(lead.clientId)!.phone) : '' }}</p>
                </div>
              </div>
            </td>
            <td>
              <span class="inline-flex items-center gap-1.5 text-[12.5px]">
                <span class="h-2 w-2 rounded-sm" :style="{ background: LEAD_STAGE_COLOR[lead.stage] }" />
                {{ LEAD_STAGE_META[lead.stage].label }}
              </span>
            </td>
            <td class="tabular text-right font-semibold">{{ lead.budget ? money(lead.budget) : '—' }}</td>
            <td :class="TASK_TONE[salesStore.taskState(lead)]">
              <span class="text-[12.5px]">{{ salesStore.openTask(lead)?.title ?? (lead.stage === 'deal' || lead.stage === 'lost' ? '—' : 'Задачи нет') }}</span>
              <span v-if="salesStore.openTask(lead)" class="ml-1 text-[11.5px]">· {{ fmtDate(salesStore.openTask(lead)!.dueAt) }}</span>
            </td>
            <td class="text-[12.5px]">{{ settingsStore.users.find((u) => u.id === lead.assignedTo)?.name ?? '—' }}</td>
            <td class="text-[12.5px] text-muted">{{ lead.source }}</td>
            <td class="tabular text-right">{{ salesStore.daysInStage(lead) }} д.</td>
          </tr>
        </tbody>
      </table>
    </div>
    <EmptyState v-if="!leads.length" compact icon="ph:funnel" title="Заявок не найдено" text="Измените фильтры или сбросьте их" class="m-5" />
  </AppCard>
</template>
