<script setup lang="ts">
import { LEAD_STAGE_META } from '~/utils/meta'
import { fmtPhone } from '~/utils/format'

/**
 * Планирование прямо из календаря. Задача в системе всегда принадлежит
 * заявке — «задач вообще», ни к кому не привязанных, в CRM нет, иначе они
 * теряются мимо воронки. Поэтому шаг первый — выбрать клиента, шаг второй —
 * та же форма задачи, что и в карточке заявки.
 */
const props = defineProps<{ modelValue: boolean; due?: string }>()
const emit = defineEmits<{ 'update:modelValue': [boolean] }>()

const salesStore = useSalesStore()
const { seesEveryone, myId } = useAccess()

const leadId = ref<string | null>(null)
const search = ref('')

// открытие с новым часом начинает выбор заново: прошлый клиент к новому
// слоту отношения не имеет
watch(() => props.modelValue, (v) => { if (v) { leadId.value = null; search.value = '' } })

const dueLabel = computed(() => (props.due
  ? new Date(props.due).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
  : 'срок выберете в форме'))

const candidates = computed(() => {
  const q = search.value.trim().toLowerCase()
  return salesStore.leads
    .filter((l) => l.stage !== 'lost')
    .filter((l) => seesEveryone.value || l.assignedTo === myId.value)
    .map((l) => ({ lead: l, client: salesStore.client(l.clientId) }))
    .filter(({ client }) => !q || client?.name.toLowerCase().includes(q) || client?.phone.includes(q.replace(/\D/g, '')))
    .slice(0, 40)
})

const chosen = computed(() => (leadId.value ? salesStore.client(salesStore.lead(leadId.value)?.clientId ?? '') : undefined))
</script>

<template>
  <AppDrawer
    :model-value="modelValue" title="Запланировать дело" :subtitle="dueLabel" width="440px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-if="!leadId" class="flex flex-col gap-3">
      <AppInput v-model="search" placeholder="Клиент или телефон" icon="ph:magnifying-glass" />
      <p class="text-[12px] text-muted">По какой заявке дело?</p>
      <div class="-mx-1 flex flex-col">
        <button
          v-for="c in candidates" :key="c.lead.id" type="button"
          class="focus-ring flex items-center gap-2.5 rounded-xl2 px-1.5 py-2 text-left transition-colors hover:bg-soft"
          @click="leadId = c.lead.id"
        >
          <AppAvatar :name="c.client?.name ?? '—'" size="sm" />
          <span class="min-w-0 flex-1">
            <span class="block truncate text-[13px] font-medium text-ink">{{ c.client?.name ?? 'Клиент' }}</span>
            <span class="block truncate text-[11.5px] text-muted">{{ c.client ? fmtPhone(c.client.phone) : '' }}</span>
          </span>
          <StatusTag :tone="LEAD_STAGE_META[c.lead.stage].tone">{{ LEAD_STAGE_META[c.lead.stage].label }}</StatusTag>
        </button>
        <EmptyState v-if="!candidates.length" compact icon="ph:user-focus" title="Заявок не нашлось" />
      </div>
    </div>

    <div v-else class="flex flex-col gap-3">
      <button
        type="button" class="focus-ring flex items-center gap-2 self-start rounded-lg px-1 py-0.5 text-[12px] font-medium text-muted hover:text-ink"
        @click="leadId = null"
      >
        <Icon name="ph:arrow-left" size="13" /> {{ chosen?.name ?? 'Заявка' }} · сменить
      </button>
      <TaskComposer :lead-id="leadId" :due="due" @done="emit('update:modelValue', false)" @cancel="emit('update:modelValue', false)" />
    </div>
  </AppDrawer>
</template>
