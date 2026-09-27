<script setup lang="ts">
import type { LeadTask, LeadTaskKind } from '~/types/models'
import { LEAD_TASK_KINDS, LEAD_TASK_KIND_META } from '~/utils/meta'

// Форма задачи с датой И временем: менеджер планирует день по часам.
const props = defineProps<{
  leadId: string
  task?: LeadTask | null
  defaultKind?: LeadTaskKind
  /** предзаполненный срок: планнер ставит задачу на тот час, по которому кликнули */
  due?: string
}>()
const emit = defineEmits<{ done: []; cancel: [] }>()

const salesStore = useSalesStore()
const settingsStore = useSettingsStore()
const auth = useAuthStore()
const ui = useUiStore()

const managers = computed(() => settingsStore.users.filter((u) => u.active && ['manager', 'commercial_director', 'director'].includes(u.role)))
const lead = computed(() => salesStore.lead(props.leadId))

function defaultDue() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(10, 0, 0, 0)
  return d
}

const form = reactive({
  kind: props.defaultKind ?? 'call' as LeadTaskKind,
  title: '',
  date: '',
  time: '',
  assignedTo: '',
})

watchEffect(() => {
  const base = props.task ? new Date(props.task.dueAt) : props.due ? new Date(props.due) : defaultDue()
  form.kind = props.task?.kind ?? props.defaultKind ?? 'call'
  form.title = props.task?.title ?? ''
  form.date = base.toISOString().slice(0, 10)
  form.time = `${String(base.getHours()).padStart(2, '0')}:${String(base.getMinutes()).padStart(2, '0')}`
  form.assignedTo = props.task?.assignedTo ?? lead.value?.assignedTo ?? auth.user?.id ?? ''
})

// подсказки по типу — набивать текст руками каждый раз незачем
const SUGGESTIONS: Record<LeadTaskKind, string[]> = {
  call: ['Перезвонить по подбору', 'Уточнить бюджет', 'Узнать решение по ипотеке'],
  meeting: ['Встреча в офисе продаж', 'Повторная встреча'],
  visit: ['Показ квартиры', 'Показ шоурума'],
  document: ['Собрать документы на ипотеку', 'Отправить КП', 'Подготовить договор'],
  other: ['Согласовать скидку', 'Проверить статус брони'],
}

function submit() {
  if (!form.title.trim()) { ui.toast('Укажите, что нужно сделать', 'warn'); return }
  const dueAt = new Date(`${form.date}T${form.time || '10:00'}`).toISOString()
  const author = auth.user?.name ?? 'Система'
  if (props.task) {
    salesStore.updateLeadTask(props.leadId, props.task.id, { kind: form.kind, title: form.title.trim(), dueAt, assignedTo: form.assignedTo }, author)
    ui.toast('Задача обновлена', 'ok')
  } else {
    salesStore.addLeadTask(props.leadId, { kind: form.kind, title: form.title.trim(), dueAt, assignedTo: form.assignedTo }, author)
    ui.toast('Задача поставлена', 'ok')
  }
  emit('done')
}
</script>

<template>
  <div class="flex flex-col gap-2.5 rounded-xl2 border border-plum bg-plum-soft/40 p-3">
    <div class="flex flex-wrap gap-1.5">
      <button
        v-for="k in LEAD_TASK_KINDS" :key="k" type="button"
        class="focus-ring flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors"
        :class="form.kind === k ? 'border-ink bg-ink text-panel' : 'border-line bg-panel text-muted hover:text-ink'"
        @click="form.kind = k"
      >
        <Icon :name="LEAD_TASK_KIND_META[k].icon" size="12" /> {{ LEAD_TASK_KIND_META[k].label }}
      </button>
    </div>

    <AppInput v-model="form.title" placeholder="Что нужно сделать" />
    <div v-if="!form.title" class="flex flex-wrap gap-1">
      <button
        v-for="sug in SUGGESTIONS[form.kind]" :key="sug" type="button"
        class="rounded-md border border-dashed border-line px-2 py-0.5 text-[11px] text-muted hover:border-plum hover:text-plum"
        @click="form.title = sug"
      >{{ sug }}</button>
    </div>

    <div class="grid grid-cols-[1fr_92px] gap-2">
      <AppInput v-model="form.date" type="date" label="Дата" />
      <AppInput v-model="form.time" type="time" label="Время" />
    </div>
    <AppSelect v-model="form.assignedTo" label="Исполнитель" :options="managers.map((u) => ({ value: u.id, label: u.name }))" />

    <div class="flex gap-2">
      <AppButton block @click="emit('cancel')">Отмена</AppButton>
      <AppButton block variant="primary" @click="submit">{{ task ? 'Сохранить' : 'Поставить' }}</AppButton>
    </div>
  </div>
</template>
