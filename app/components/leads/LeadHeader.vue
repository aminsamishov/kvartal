<script setup lang="ts">
import type { Lead, LeadStage } from '~/types/models'
import {
  LEAD_CHANNEL_ICON, LEAD_PIPELINE, LEAD_STAGE_COLOR,
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

/**
 * Этап — один переключатель, а не лента из шести плашек.
 *
 * Лента занимала верх карточки и предлагала шесть решений сразу, хотя менеджеру
 * нужно знать одно: где заявка сейчас. Куда её двигать, он решает раз в
 * несколько дней, и для этого достаточно открыть список.
 */
const stageOpen = ref(false)
const stageRef = ref<HTMLElement | null>(null)
onClickOutside(stageRef, () => { stageOpen.value = false })
watch(() => props.lead.id, () => { stageOpen.value = false })

const stages = computed<LeadStage[]>(() => [...LEAD_PIPELINE, 'lost'])
const reached = computed(() => LEAD_PIPELINE.indexOf(props.lead.stage))

function pick(stage: LeadStage) {
  stageOpen.value = false
  if (stage !== props.lead.stage) emit('stage', stage)
}
</script>

<template>
  <header class="border-b border-line bg-panel px-5 pb-3 pt-4">
    <!-- идентичность -->
    <div class="flex items-start gap-3">
      <AppAvatar :name="client?.name ?? '—'" size="lg" :color="manager?.avatarColor" />
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <h2 class="truncate text-[18px] font-semibold tracking-[-0.02em] text-ink">{{ client?.name ?? 'Без клиента' }}</h2>

          <!-- текущий этап -->
          <div ref="stageRef" class="relative">
            <button
              type="button"
              class="focus-ring flex items-center gap-1.5 rounded-full border border-line py-1 pl-2.5 pr-2 text-[12px] font-semibold text-ink transition-colors hover:border-plum"
              :title="`Этап: ${LEAD_STAGE_META[lead.stage].label}`"
              @click="stageOpen = !stageOpen"
            >
              <span class="h-1.5 w-1.5 shrink-0 rounded-full" :style="{ background: LEAD_STAGE_COLOR[lead.stage] }" />
              {{ LEAD_STAGE_META[lead.stage].label }}
              <Icon name="ph:caret-down" size="11" class="text-muted" />
            </button>

            <div
              v-if="stageOpen"
              class="animate-pop-in absolute left-0 top-[calc(100%+4px)] z-30 w-[190px] overflow-hidden rounded-card border border-line bg-panel py-1 shadow-pop"
            >
              <p class="px-3 pb-1 pt-1.5 text-[10.5px] font-semibold uppercase tracking-[0.04em] text-muted">Перевести на этап</p>
              <button
                v-for="(s, i) in stages" :key="s" type="button"
                class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12.5px] font-medium transition-colors"
                :class="[
                  lead.stage === s ? 'bg-soft text-ink' : 'text-muted hover:bg-soft hover:text-ink',
                  s === 'lost' ? 'mt-1 border-t border-line pt-2' : '',
                ]"
                @click="pick(s)"
              >
                <Icon
                  :name="LEAD_STAGE_ICON[s]" size="13"
                  :style="{ color: s === lead.stage || reached > i ? LEAD_STAGE_COLOR[s] : undefined }"
                />
                {{ LEAD_STAGE_META[s].label }}
                <Icon v-if="lead.stage === s" name="ph:check-bold" size="11" class="ml-auto text-plum" />
              </button>
            </div>
          </div>

          <span class="tabular text-[11.5px] text-muted">{{ days }} дн. на этапе</span>
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

    <p v-if="lead.lostReason" class="mt-2 text-[11.5px] text-bad">Причина отказа: {{ lead.lostReason }}</p>
  </header>
</template>
