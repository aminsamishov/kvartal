<script setup lang="ts">
import type { Lead, LeadPriority } from '~/types/models'
import { LEAD_CHANNEL_ICON, LEAD_PRIORITY_META, LEAD_TAGS } from '~/utils/meta'
import { fmtDate, fmtDateTime, fmtPhone, money } from '~/utils/format'

/**
 * Досье заявки: то, что менеджер меняет прямо в карточке — ответственный,
 * приоритет, теги. Остальное справочно, но рядом: смена ответственного из
 * отдельного экрана заставляла бы терять контекст.
 */
const props = defineProps<{ lead: Lead }>()

const salesStore = useSalesStore()
const settingsStore = useSettingsStore()
const auth = useAuthStore()
const ui = useUiStore()

const client = computed(() => salesStore.client(props.lead.clientId))
const manager = computed(() => settingsStore.users.find((u) => u.id === props.lead.assignedTo))
const managers = computed(() => settingsStore.users.filter((u) => u.active
  && ['manager', 'commercial_director', 'director'].includes(u.role)))
const author = computed(() => auth.user?.name ?? 'Система')
const days = computed(() => salesStore.daysInStage(props.lead))

const editing = ref(false)

function assign(userId: string) {
  const user = managers.value.find((u) => u.id === userId)
  if (!user) return
  salesStore.assignLead(props.lead.id, user.id, user.name, author.value)
  ui.toast(`Ответственный: ${user.name}`, 'ok')
}
function setPriority(p: LeadPriority) {
  salesStore.setLeadPriority(props.lead.id, p)
}

const rows = computed(() => [
  ['Телефон', client.value?.phone ? fmtPhone(client.value.phone) : '—'],
  ['Почта', client.value?.email ?? '—'],
  ['Источник', `${props.lead.source}${props.lead.channel && props.lead.channel !== props.lead.source ? ` · ${props.lead.channel}` : ''}`],
  ['Создана', fmtDate(props.lead.createdAt)],
  ['На этапе', `${days.value} дн.`],
  ['Последний контакт', props.lead.lastContactAt ? fmtDateTime(props.lead.lastContactAt) : 'не было'],
  ['Бюджет', props.lead.budget ? money(props.lead.budget) : 'не указан'],
] as [string, string][])
</script>

<template>
  <AppCard :padded="false">
    <div class="flex items-center justify-between gap-3 px-4 pt-4">
      <h3 class="text-[13px] font-semibold uppercase tracking-[0.04em] text-muted">Досье</h3>
      <AppButton size="sm" :icon="editing ? 'ph:x' : 'ph:pencil-simple'" @click="editing = !editing">
        {{ editing ? 'Готово' : 'Изменить' }}
      </AppButton>
    </div>

    <div class="p-4">
      <!-- ответственный -->
      <div class="flex items-center gap-2.5 rounded-xl2 border border-line p-2.5">
        <AppAvatar :name="manager?.name ?? '—'" :color="manager?.avatarColor" size="sm" />
        <div class="min-w-0 flex-1">
          <p class="truncate text-[12.5px] font-semibold text-ink">{{ manager?.name ?? 'Не назначен' }}</p>
          <p class="text-[11px] text-muted">Ответственный менеджер</p>
        </div>
        <select
          v-if="editing"
          class="focus-ring max-w-[140px] rounded-lg border border-line bg-panel px-2 py-1.5 text-[12px] font-medium text-ink"
          :value="lead.assignedTo"
          @change="assign(($event.target as HTMLSelectElement).value)"
        >
          <option v-for="u in managers" :key="u.id" :value="u.id">{{ u.name }}</option>
        </select>
      </div>

      <!-- приоритет -->
      <div class="mt-3">
        <p class="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted">Приоритет</p>
        <div class="flex gap-1.5">
          <Chip
            v-for="p in (['high', 'normal', 'low'] as LeadPriority[])" :key="p"
            :pressed="lead.priority === p" @click="setPriority(p)"
          >
            <span class="h-1.5 w-1.5 rounded-full" :style="{ background: LEAD_PRIORITY_META[p].color }" />
            {{ LEAD_PRIORITY_META[p].label }}
          </Chip>
        </div>
      </div>

      <!-- теги -->
      <div class="mt-3">
        <p class="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted">Теги</p>
        <div v-if="editing" class="flex flex-wrap gap-1.5">
          <Chip
            v-for="t in LEAD_TAGS" :key="t" :pressed="lead.tags.includes(t)"
            @click="salesStore.toggleLeadTag(lead.id, t)"
          >{{ t }}</Chip>
        </div>
        <div v-else-if="lead.tags.length" class="flex flex-wrap gap-1.5">
          <StatusTag v-for="t in lead.tags" :key="t" tone="plum" size="sm">{{ t }}</StatusTag>
        </div>
        <p v-else class="text-[12px] text-muted">Тегов нет</p>
      </div>

      <!-- справка -->
      <dl class="mt-3 border-t border-line pt-1">
        <div v-for="[label, value] in rows" :key="label" class="flex items-baseline justify-between gap-3 border-b border-line py-1.5 last:border-0">
          <dt class="shrink-0 text-[12px] text-muted">{{ label }}</dt>
          <dd class="truncate text-right text-[12.5px] font-medium text-ink">{{ value }}</dd>
        </div>
      </dl>

      <div class="mt-2.5 flex items-center gap-1.5">
        <Icon :name="LEAD_CHANNEL_ICON[lead.channel] ?? 'ph:chat-circle'" size="13" class="text-muted" />
        <NuxtLink to="/clients" class="text-[12px] font-semibold text-plum hover:underline">Карточка клиента</NuxtLink>
      </div>
    </div>
  </AppCard>
</template>
