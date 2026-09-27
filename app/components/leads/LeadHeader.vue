<script setup lang="ts">
import type { Lead, LeadStage } from '~/types/models'
import {
  LEAD_CHANNEL_ICON, LEAD_PIPELINE, LEAD_PRIORITY_META, LEAD_STAGE_COLOR,
  LEAD_STAGE_ICON, LEAD_STAGE_META,
} from '~/utils/meta'
import { fmtPhone, money } from '~/utils/format'

const props = defineProps<{ lead: Lead }>()
const emit = defineEmits<{
  stage: [LeadStage]
  call: []
  whatsapp: []
  visit: []
  reserve: []
  contract: []
}>()

const salesStore = useSalesStore()
const settingsStore = useSettingsStore()

const client = computed(() => salesStore.client(props.lead.clientId))
const manager = computed(() => settingsStore.users.find((u) => u.id === props.lead.assignedTo))
const days = computed(() => salesStore.daysInStage(props.lead))
const closed = computed(() => props.lead.stage === 'deal' || props.lead.stage === 'lost')
const reached = computed(() => LEAD_PIPELINE.indexOf(props.lead.stage))
</script>

<template>
  <header class="border-b border-line bg-panel px-5 pb-3 pt-4">
    <!-- идентичность -->
    <div class="flex items-start gap-3">
      <AppAvatar :name="client?.name ?? '—'" size="lg" :color="manager?.avatarColor" />
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <h2 class="truncate text-[18px] font-semibold tracking-[-0.02em] text-ink">{{ client?.name ?? 'Без клиента' }}</h2>
          <StatusTag :tone="LEAD_STAGE_META[lead.stage].tone" size="sm" dot>{{ LEAD_STAGE_META[lead.stage].label }}</StatusTag>
          <span class="tabular text-[11.5px] text-muted">· {{ days }} дн. на этапе</span>
          <StatusTag v-if="lead.priority === 'high'" tone="bad" size="sm" icon="ph:flame">Высокий</StatusTag>
        </div>
        <div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-muted">
          <a v-if="client?.phone" :href="`tel:+${client.phone}`" class="flex items-center gap-1 hover:text-plum" @click="emit('call')">
            <Icon name="ph:phone" size="12" /> {{ fmtPhone(client.phone) }}
          </a>
          <a v-if="client?.email" :href="`mailto:${client.email}`" class="flex items-center gap-1 hover:text-plum">
            <Icon name="ph:envelope-simple" size="12" /> {{ client.email }}
          </a>
          <span class="flex items-center gap-1">
            <Icon :name="LEAD_CHANNEL_ICON[lead.channel] ?? 'ph:chat-circle'" size="12" /> {{ lead.source }}
          </span>
          <span v-if="manager" class="flex items-center gap-1">
            <Icon name="ph:user" size="12" /> {{ manager.name }}
          </span>
          <span class="flex items-center gap-1">
            <span class="h-1.5 w-1.5 rounded-full" :style="{ background: LEAD_PRIORITY_META[lead.priority].color }" />
            {{ LEAD_PRIORITY_META[lead.priority].label }}
          </span>
        </div>
      </div>
      <p class="tabular shrink-0 text-right text-[19px] font-semibold tracking-[-0.02em] text-ink">
        {{ lead.budget ? money(lead.budget) : '—' }}
        <span class="block text-[10.5px] font-medium uppercase tracking-[0.04em] text-muted">бюджет</span>
      </p>
    </div>

    <!-- быстрые действия -->
    <div class="mt-3 flex flex-wrap gap-1.5">
      <AppButton size="sm" icon="ph:phone" :disabled="!client?.phone" @click="emit('call')">Позвонить</AppButton>
      <AppButton size="sm" icon="ph:whatsapp-logo" :disabled="!client?.phone" @click="emit('whatsapp')">WhatsApp</AppButton>
      <AppButton size="sm" icon="ph:calendar-plus" @click="emit('visit')">Назначить показ</AppButton>
      <AppButton size="sm" icon="ph:bookmark-simple" :disabled="closed" @click="emit('reserve')">Забронировать</AppButton>
      <AppButton size="sm" variant="primary" icon="ph:file-text" :disabled="lead.stage === 'lost'" @click="emit('contract')">Создать договор</AppButton>
    </div>

    <!-- воронка -->
    <div class="mt-3 flex items-stretch gap-1">
      <button
        v-for="(s, i) in LEAD_PIPELINE" :key="s" type="button"
        class="focus-ring relative flex-1 overflow-hidden rounded-lg border px-1.5 pb-1.5 pt-2 text-center transition-colors"
        :class="lead.stage === s
          ? 'border-ink bg-ink text-panel'
          : reached > i
            ? 'border-line bg-soft text-muted hover:bg-plum-soft'
            : 'border-dashed border-line text-muted hover:border-plum hover:text-plum'"
        :title="`Перевести в «${LEAD_STAGE_META[s].label}»`"
        @click="emit('stage', s)"
      >
        <span class="absolute inset-x-0 top-0 h-[3px]" :style="{ background: LEAD_STAGE_COLOR[s], opacity: reached >= i ? 1 : 0.3 }" />
        <Icon :name="LEAD_STAGE_ICON[s]" size="12" />
        <span class="mt-0.5 block truncate text-[10px] font-semibold">{{ LEAD_STAGE_META[s].label }}</span>
      </button>
      <button
        type="button"
        class="focus-ring w-[52px] shrink-0 rounded-lg border px-1 pb-1.5 pt-2 text-center transition-colors"
        :class="lead.stage === 'lost' ? 'border-bad bg-bad-bg text-bad' : 'border-dashed border-line text-muted hover:border-bad hover:text-bad'"
        title="Перевести в «Отказ»"
        @click="emit('stage', 'lost')"
      >
        <Icon name="ph:prohibit" size="12" />
        <span class="mt-0.5 block text-[10px] font-semibold">Отказ</span>
      </button>
    </div>
    <p v-if="lead.lostReason" class="mt-1.5 text-[11.5px] text-bad">Причина отказа: {{ lead.lostReason }}</p>
  </header>
</template>
