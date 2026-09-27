<script setup lang="ts">
import type { ActionKind, AutomationRule, AutomationTriggerKind, ConditionField } from '~/types/automation'
import { ACTION_META, FIELD_META, OP_LABEL, TRIGGER_META } from '~/types/automation'
import {
  describeRule, fieldOptions, newAction, newCondition, newRule, taskKindOptions, TEMPLATE_VARS, type FieldOption,
} from '~/utils/automation'
import { LEAD_STAGE_META, LEAD_TAGS } from '~/utils/meta'

/**
 * Конструктор правила: событие → условия → действия, и внизу — фраза, которую
 * правило означает. Сценарий собирается мышью, без разработчика; предпросмотр
 * нужен, чтобы автор видел ровно то, что система будет делать.
 */
const props = defineProps<{
  modelValue: boolean
  /** правило для правки; null — создаём новое */
  rule: AutomationRule | null
  projects: FieldOption[]
  sources: string[]
}>()
const emit = defineEmits<{ 'update:modelValue': [boolean]; save: [AutomationRule] }>()

const settings = useSettingsStore()
const ui = useUiStore()

const draft = ref<AutomationRule>(newRule('lead.created'))

watch(() => [props.modelValue, props.rule] as const, ([open]) => {
  if (!open) return
  draft.value = props.rule
    ? JSON.parse(JSON.stringify(props.rule))
    : newRule('lead.created')
}, { immediate: true })

const meta = computed(() => TRIGGER_META[draft.value.trigger])

/** Группы триггеров — так менеджер ищет событие по своему участку работы. */
const triggerGroups = computed(() => {
  const groups = new Map<string, { kind: AutomationTriggerKind; label: string; icon: string; hint: string }[]>()
  for (const [kind, m] of Object.entries(TRIGGER_META) as [AutomationTriggerKind, typeof meta.value][]) {
    const list = groups.get(m.group) ?? []
    list.push({ kind, label: m.label, icon: m.icon, hint: m.hint })
    groups.set(m.group, list)
  }
  return [...groups.entries()]
})

function pickTrigger(kind: AutomationTriggerKind) {
  if (draft.value.trigger === kind) return
  const fresh = newRule(kind)
  // имя правила менял автор — не затираем его выбором другого события
  const custom = draft.value.name && draft.value.name !== TRIGGER_META[draft.value.trigger].label
  draft.value = { ...fresh, id: draft.value.id, name: custom ? draft.value.name : fresh.name, runs: draft.value.runs, builtin: draft.value.builtin }
}

/* -------------------------------- условия -------------------------------- */

const availableFields = computed(() => meta.value.fields
  .filter((f) => !draft.value.conditions.some((c) => c.field === f))
  .map((f) => ({ value: f, label: FIELD_META[f].label })))

function addCondition(field: ConditionField) {
  draft.value.conditions.push(newCondition(field))
}
function valueOptions(field: ConditionField) {
  return fieldOptions(field, props.projects, props.sources)
}

/* -------------------------------- действия ------------------------------- */

const availableActions = computed(() => meta.value.actions
  .filter((a) => !draft.value.actions.some((x) => x.kind === a))
  .map((a) => ({ value: a, label: ACTION_META[a].label, icon: ACTION_META[a].icon })))

function addAction(kind: ActionKind) {
  draft.value.actions.push(newAction(kind))
}

const targetOptions = computed(() => [
  { value: 'manager', label: 'Менеджеру объекта' },
  { value: 'head', label: 'Руководителю отдела' },
  { value: 'director', label: 'Директору' },
  ...settings.users.filter((u) => u.active).map((u) => ({ value: u.id, label: u.name })),
])

const stageOptions = Object.entries(LEAD_STAGE_META).map(([value, m]) => ({ value, label: m.label }))
const tagOptions = LEAD_TAGS.map((t) => ({ value: t, label: t }))

/* ------------------------------ окно ожидания ----------------------------- */

const offsetValue = computed({
  get: () => {
    const o = meta.value.offset
    if (!o) return 0
    return o.suffix === 'дн.' ? Math.round((draft.value.offsetHours ?? 0) / 24) : draft.value.offsetHours ?? 0
  },
  set: (v: number) => {
    const o = meta.value.offset
    if (!o) return
    const clamped = Math.min(o.max, Math.max(o.min, Math.round(v) || o.default))
    draft.value.offsetHours = o.suffix === 'дн.' ? clamped * 24 : clamped
  },
})

/* ------------------------------ предпросмотр ------------------------------ */

const preview = computed(() => describeRule(
  draft.value, props.projects,
  (id) => settings.users.find((u) => u.id === id)?.name ?? 'сотруднику',
))

function save() {
  if (!draft.value.name.trim()) { ui.toast('Дайте правилу название — по нему его будут искать', 'warn'); return }
  if (!draft.value.actions.length) { ui.toast('Правило без действий ничего не делает', 'warn'); return }
  // условие с пустым значением не сработает никогда — это тихая поломка правила
  const empty = draft.value.conditions.find((c) => c.value === '' || c.value === null)
  if (empty) { ui.toast(`Выберите значение для условия «${FIELD_META[empty.field].label}»`, 'warn'); return }
  const blank = draft.value.actions.find((a) => ACTION_META[a.kind].params.includes('text') && !a.text?.trim())
  if (blank) { ui.toast(`Заполните текст действия «${ACTION_META[blank.kind].label}»`, 'warn'); return }
  emit('save', { ...draft.value, name: draft.value.name.trim() })
  emit('update:modelValue', false)
}
</script>

<template>
  <AppDrawer
    :model-value="modelValue" width="min(680px, 96vw)"
    :title="rule ? 'Настройка правила' : 'Новое правило'"
    subtitle="Событие → условия → действия. Без кода."
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="flex flex-col gap-5">
      <AppInput v-model="draft.name" label="Название правила" placeholder="Например: предупредить о брони за сутки" />

      <!-- 1. событие -->
      <section>
        <h4 class="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.05em] text-muted">
          <span class="grid h-5 w-5 place-items-center rounded-full bg-ink text-[10px] font-bold text-panel">1</span>
          Когда это происходит
        </h4>
        <div v-for="[group, items] in triggerGroups" :key="group" class="mb-2.5">
          <p class="mb-1 text-[11px] text-muted">{{ group }}</p>
          <div class="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            <button
              v-for="t in items" :key="t.kind" type="button"
              class="focus-ring flex items-start gap-2 rounded-xl2 border px-2.5 py-2 text-left transition-colors"
              :class="draft.trigger === t.kind ? 'border-ink bg-soft' : 'border-line hover:border-plum/50'"
              @click="pickTrigger(t.kind)"
            >
              <Icon :name="t.icon" size="16" class="mt-0.5 shrink-0" :class="draft.trigger === t.kind ? 'text-plum' : 'text-muted'" />
              <span class="min-w-0">
                <span class="block text-[12.5px] font-semibold text-ink">{{ t.label }}</span>
                <span class="block text-[11px] leading-tight text-muted">{{ t.hint }}</span>
              </span>
            </button>
          </div>
        </div>

        <div v-if="meta.offset" class="mt-2 flex flex-wrap items-end gap-2 rounded-xl2 bg-soft px-3 py-2.5">
          <AppInput
            :model-value="offsetValue" type="number" class="w-[190px]"
            :label="meta.offset.label" :suffix="meta.offset.suffix"
            @update:model-value="offsetValue = Number($event)"
          />
          <p class="pb-2.5 text-[11.5px] text-muted">
            от {{ meta.offset.min }} до {{ meta.offset.max }} {{ meta.offset.suffix }}
          </p>
        </div>
      </section>

      <!-- 2. условия -->
      <section>
        <h4 class="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.05em] text-muted">
          <span class="grid h-5 w-5 place-items-center rounded-full bg-ink text-[10px] font-bold text-panel">2</span>
          При каких условиях
        </h4>

        <div v-if="draft.conditions.length" class="flex flex-col gap-2">
          <div
            v-for="(c, i) in draft.conditions" :key="c.id"
            class="flex flex-wrap items-end gap-2 rounded-xl2 border border-line p-2.5"
          >
            <span class="pb-2.5 text-[11.5px] font-semibold text-muted">{{ i ? 'и' : 'если' }}</span>
            <p class="pb-2.5 text-[12.5px] font-medium text-ink">{{ FIELD_META[c.field].label }}</p>
            <AppSelect
              v-model="c.op" class="w-[112px]"
              :options="FIELD_META[c.field].ops.map((op) => ({ value: op, label: OP_LABEL[op] }))"
            />
            <AppSelect
              v-if="FIELD_META[c.field].kind === 'select'" v-model="c.value" class="min-w-[160px] flex-1"
              :options="valueOptions(c.field)" placeholder="выберите значение"
            />
            <AppInput
              v-else v-model.number="c.value" type="number" class="w-[140px]"
              :suffix="FIELD_META[c.field].suffix"
            />
            <button
              class="focus-ring mb-1 grid h-8 w-8 place-items-center rounded-lg text-muted hover:text-bad"
              title="Убрать условие" @click="draft.conditions = draft.conditions.filter((x) => x.id !== c.id)"
            ><Icon name="ph:x" size="14" /></button>
          </div>
        </div>
        <p v-else class="rounded-xl2 bg-soft px-3 py-2 text-[12px] text-muted">
          Условий нет — правило сработает при каждом таком событии.
        </p>

        <div v-if="availableFields.length" class="mt-2 flex flex-wrap gap-1.5">
          <Chip
            v-for="f in availableFields" :key="f.value" icon="ph:plus"
            @click="addCondition(f.value as ConditionField)"
          >{{ f.label }}</Chip>
        </div>
      </section>

      <!-- 3. действия -->
      <section>
        <h4 class="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.05em] text-muted">
          <span class="grid h-5 w-5 place-items-center rounded-full bg-ink text-[10px] font-bold text-panel">3</span>
          Что сделать
        </h4>

        <div class="flex flex-col gap-2">
          <div v-for="a in draft.actions" :key="a.id" class="rounded-xl2 border border-line p-2.5">
            <div class="flex items-center gap-2">
              <Icon :name="ACTION_META[a.kind].icon" size="15" class="shrink-0 text-plum" />
              <p class="text-[12.5px] font-semibold text-ink">{{ ACTION_META[a.kind].label }}</p>
              <p class="hidden text-[11px] text-muted sm:block">{{ ACTION_META[a.kind].hint }}</p>
              <button
                class="focus-ring ml-auto grid h-7 w-7 place-items-center rounded-lg text-muted hover:text-bad"
                title="Убрать действие" @click="draft.actions = draft.actions.filter((x) => x.id !== a.id)"
              ><Icon name="ph:x" size="14" /></button>
            </div>

            <div class="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <AppSelect
                v-if="ACTION_META[a.kind].params.includes('target')" v-model="a.target"
                :label="a.kind === 'task' ? 'Исполнитель' : 'Кому'" :options="targetOptions"
              />
              <AppSelect
                v-if="ACTION_META[a.kind].params.includes('taskKind')" v-model="a.value"
                label="Вид задачи" :options="taskKindOptions()"
              />
              <AppInput
                v-if="ACTION_META[a.kind].params.includes('delay')" v-model.number="a.delayHours" type="number"
                label="Отложить" suffix="ч."
              />
              <AppSelect
                v-if="ACTION_META[a.kind].params.includes('stage')" v-model="a.value"
                label="Этап воронки" :options="stageOptions"
              />
              <AppSelect
                v-if="ACTION_META[a.kind].params.includes('tag')" v-model="a.value"
                label="Метка" :options="tagOptions"
              />
              <AppInput
                v-if="ACTION_META[a.kind].params.includes('text')" v-model="a.text" class="sm:col-span-2"
                :label="a.kind === 'task' ? 'Название задачи' : 'Текст уведомления'"
                :placeholder="a.kind === 'task' ? 'Позвонить клиенту {клиент}' : 'Бронь на {объект} истекает {срок}'"
              />
            </div>

            <p v-if="ACTION_META[a.kind].params.includes('text')" class="mt-1.5 flex flex-wrap items-center gap-1 text-[11px] text-muted">
              Подстановки:
              <button
                v-for="v in TEMPLATE_VARS" :key="v" type="button"
                class="focus-ring rounded bg-soft px-1 py-0.5 font-medium text-ink hover:text-plum"
                @click="a.text = `${a.text ?? ''}{${v}}`"
              >{{ '{' + v + '}' }}</button>
            </p>
          </div>
        </div>

        <div v-if="availableActions.length" class="mt-2 flex flex-wrap gap-1.5">
          <Chip v-for="a in availableActions" :key="a.value" icon="ph:plus" @click="addAction(a.value as ActionKind)">
            {{ a.label }}
          </Chip>
        </div>
      </section>

      <!-- предпросмотр -->
      <section class="rounded-card border border-line bg-soft/70 p-3">
        <p class="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted">Правило целиком</p>
        <p class="mt-1 text-[13px] leading-snug text-ink">{{ preview }}</p>
      </section>
    </div>

    <template #footer>
      <div class="flex gap-2">
        <AppButton block @click="emit('update:modelValue', false)">Отмена</AppButton>
        <AppButton block variant="primary" icon="ph:check-bold" @click="save">Сохранить правило</AppButton>
      </div>
    </template>
  </AppDrawer>
</template>
