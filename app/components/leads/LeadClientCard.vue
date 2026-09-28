<script setup lang="ts">
import type { Lead, LeadPriority } from '~/types/models'
import { CLIENT_ORIGIN_META, LEAD_CHANNEL_ICON, LEAD_PRIORITY_META, LEAD_TAGS, MARITAL_STATUS_META } from '~/utils/meta'
import { fmtDate, fmtDateTime, fmtPhone, money } from '~/utils/format'

/**
 * Клиент — главный блок карточки заявки.
 *
 * Менеджер открывает заявку, чтобы позвонить человеку, и первым делом ему
 * нужны не графики и не советы, а кто это и как с ним связаться. Поэтому здесь
 * всё, что известно о клиенте, — контакты, паспорт, реквизиты — и рядом то,
 * что относится к самой заявке и правится на месте: ответственный, приоритет,
 * теги.
 *
 * Данные клиента показаны как есть: правятся они в карточке клиента, где
 * живут, — дублировать форму редактирования в заявке значит завести второй
 * источник правды.
 */
const props = defineProps<{ lead: Lead }>()
const emit = defineEmits<{ call: []; whatsapp: [] }>()

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
watch(() => props.lead.id, () => { editing.value = false })

function assign(userId: string) {
  const user = managers.value.find((u) => u.id === userId)
  if (!user) return
  salesStore.assignLead(props.lead.id, user.id, user.name, author.value)
  ui.toast(`Ответственный: ${user.name}`, 'ok')
}
function setPriority(p: LeadPriority) {
  salesStore.setLeadPriority(props.lead.id, p)
}

/** Пустые поля не прячем: менеджер должен видеть, что именно не заполнено. */
const contactRows = computed(() => {
  const c = client.value
  return [
    ['Телефон', c?.phone ? fmtPhone(c.phone) : '—'],
    ['WhatsApp', c?.whatsapp ? fmtPhone(c.whatsapp) : c?.phone ? fmtPhone(c.phone) : '—'],
    ['Почта', c?.email ?? '—'],
    ['Дата рождения', c?.birthDate ? fmtDate(c.birthDate) : '—'],
    ['Адрес', c?.address ?? '—'],
    ['Паспорт', c?.passportMasked ?? '—'],
    ['ИНН', c?.inn ?? '—'],
    ['Семейное положение', c?.maritalStatus ? MARITAL_STATUS_META[c.maritalStatus] : '—'],
  ] as [string, string][]
})

const leadRows = computed(() => [
  ['Источник', `${props.lead.source}${props.lead.channel && props.lead.channel !== props.lead.source ? ` · ${props.lead.channel}` : ''}`],
  ['Бюджет', props.lead.budget ? money(props.lead.budget) : 'не указан'],
  ['Создана', fmtDate(props.lead.createdAt)],
  ['На этапе', `${days.value} дн.`],
  ['Последний контакт', props.lead.lastContactAt ? fmtDateTime(props.lead.lastContactAt) : 'не было'],
] as [string, string][])
</script>

<template>
  <AppCard :padded="false">
    <div class="flex items-center justify-between gap-3 px-4 pt-4">
      <h3 class="text-[13px] font-semibold uppercase tracking-[0.04em] text-muted">Клиент</h3>
      <NuxtLink to="/clients" class="flex items-center gap-1 text-[12px] font-semibold text-plum hover:underline">
        Карточка клиента <Icon name="ph:arrow-up-right" size="12" />
      </NuxtLink>
    </div>

    <div class="p-4">
      <!-- кто это и как связаться -->
      <div class="flex items-start gap-3">
        <AppAvatar :name="client?.name ?? '—'" size="lg" :color="manager?.avatarColor" />
        <div class="min-w-0 flex-1">
          <p class="truncate text-[15px] font-semibold text-ink">{{ client?.name ?? 'Без клиента' }}</p>
          <div class="mt-1 flex flex-wrap items-center gap-1.5">
            <StatusTag size="sm" tone="neutral">{{ client?.kind === 'company' ? 'Компания' : 'Физлицо' }}</StatusTag>
            <StatusTag v-if="client?.origin" size="sm" :tone="CLIENT_ORIGIN_META[client.origin].tone">
              {{ CLIENT_ORIGIN_META[client.origin].label }}
            </StatusTag>
            <StatusTag v-if="client?.vip" size="sm" tone="plum" icon="ph:star">VIP</StatusTag>
          </div>
        </div>
      </div>

      <div class="mt-3 flex gap-2">
        <AppButton size="sm" block icon="ph:phone" :disabled="!client?.phone" @click="emit('call')">Позвонить</AppButton>
        <AppButton size="sm" block icon="ph:whatsapp-logo" :disabled="!client?.phone" @click="emit('whatsapp')">WhatsApp</AppButton>
      </div>

      <!-- контакты и реквизиты -->
      <dl class="mt-3 grid grid-cols-1 gap-x-6 sm:grid-cols-2">
        <div
          v-for="[label, value] in contactRows" :key="label"
          class="flex items-baseline justify-between gap-3 border-b border-line py-1.5"
        >
          <dt class="shrink-0 text-[12px] text-muted">{{ label }}</dt>
          <dd class="truncate text-right text-[12.5px] font-medium" :class="value === '—' ? 'text-muted' : 'text-ink'">{{ value }}</dd>
        </div>
      </dl>

      <p v-if="client?.note" class="mt-3 rounded-xl2 bg-soft px-3 py-2 text-[12.5px] leading-snug text-ink">
        <Icon name="ph:note" size="13" class="mr-1 text-muted" />{{ client.note }}
      </p>

      <!-- заявка: то, что правится на месте -->
      <div class="mt-4 border-t border-line pt-3">
        <div class="flex items-center justify-between gap-3">
          <p class="text-[11px] font-semibold uppercase tracking-[0.04em] text-muted">Заявка</p>
          <AppButton size="sm" :icon="editing ? 'ph:x' : 'ph:pencil-simple'" @click="editing = !editing">
            {{ editing ? 'Готово' : 'Изменить' }}
          </AppButton>
        </div>

        <div class="mt-2.5 flex items-center gap-2.5 rounded-xl2 border border-line p-2.5">
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

        <dl class="mt-3">
          <div
            v-for="[label, value] in leadRows" :key="label"
            class="flex items-baseline justify-between gap-3 border-b border-line py-1.5 last:border-0"
          >
            <dt class="shrink-0 text-[12px] text-muted">{{ label }}</dt>
            <dd class="truncate text-right text-[12.5px] font-medium text-ink">{{ value }}</dd>
          </div>
        </dl>

        <p class="mt-2 flex items-center gap-1.5 text-[11.5px] text-muted">
          <Icon :name="LEAD_CHANNEL_ICON[lead.channel] ?? 'ph:chat-circle'" size="13" />
          Заявка пришла из «{{ lead.source }}»
        </p>
      </div>
    </div>
  </AppCard>
</template>
