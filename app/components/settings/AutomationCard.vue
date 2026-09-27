<script setup lang="ts">
import type { AutomationRule } from '~/types/automation'
import { ACTION_META, TRIGGER_META } from '~/types/automation'
import { actionLabel, conditionLabel, triggerLabel, type FieldOption } from '~/utils/automation'
import { fmtDateTime } from '~/utils/format'

/**
 * Правило как конвейер: слева событие, посередине условия, справа действия.
 * Руководитель читает сценарий строкой, не открывая редактор, — именно за
 * этим он заходит на экран автоматизаций.
 */
const props = defineProps<{ rule: AutomationRule; projects: FieldOption[] }>()
const emit = defineEmits<{ edit: []; toggle: []; duplicate: []; remove: [] }>()

const settings = useSettingsStore()
const meta = computed(() => TRIGGER_META[props.rule.trigger])

const ACCENT: Record<string, string> = {
  Продажи: 'var(--mod-sales)', Бронь: 'var(--mod-reserve)', Финансы: 'var(--mod-finance)',
}
const accent = computed(() => ACCENT[meta.value.group] ?? 'var(--mod-system)')

function userName(id: string) {
  return settings.users.find((u) => u.id === id)?.name ?? 'сотруднику'
}
</script>

<template>
  <article
    class="rounded-card border bg-panel p-4 transition-colors"
    :class="rule.enabled ? 'border-line' : 'border-dashed border-line opacity-70'"
  >
    <header class="flex flex-wrap items-start gap-3">
      <span
        class="grid h-9 w-9 shrink-0 place-items-center rounded-xl2"
        :style="{
          background: rule.enabled ? `color-mix(in srgb, ${accent} 16%, transparent)` : 'var(--soft)',
          color: rule.enabled ? accent : 'var(--muted)',
        }"
      ><Icon :name="meta.icon" size="17" /></span>

      <div class="min-w-0 flex-1">
        <p class="flex flex-wrap items-center gap-1.5 text-[13.5px] font-semibold text-ink">
          {{ rule.name }}
          <StatusTag v-if="rule.builtin" tone="neutral" size="sm">Встроенное</StatusTag>
        </p>
        <p class="mt-0.5 text-[11.5px] text-muted">{{ meta.hint }}</p>
      </div>

      <AppSwitch
        :model-value="rule.enabled" :label="rule.enabled ? 'Включено' : 'Выключено'"
        @update:model-value="emit('toggle')"
      />
    </header>

    <!-- конвейер -->
    <div class="mt-3 flex flex-col gap-2 rounded-xl2 bg-soft/70 p-2.5 lg:flex-row lg:items-stretch">
      <div class="min-w-0 lg:w-[30%]">
        <p class="text-[10.5px] font-semibold uppercase tracking-[0.05em] text-muted">Когда</p>
        <p class="mt-1 text-[12.5px] font-medium text-ink">{{ triggerLabel(rule) }}</p>
      </div>

      <Icon name="ph:caret-right" size="13" class="hidden shrink-0 self-center text-muted lg:block" />

      <div class="min-w-0 lg:w-[30%]">
        <p class="text-[10.5px] font-semibold uppercase tracking-[0.05em] text-muted">Если</p>
        <div v-if="rule.conditions.length" class="mt-1 flex flex-wrap gap-1">
          <span
            v-for="c in rule.conditions" :key="c.id"
            class="rounded-lg bg-panel px-1.5 py-0.5 text-[11.5px] text-ink ring-1 ring-line"
          >{{ conditionLabel(c, projects) }}</span>
        </div>
        <p v-else class="mt-1 text-[12.5px] text-muted">без условий — всегда</p>
      </div>

      <Icon name="ph:caret-right" size="13" class="hidden shrink-0 self-center text-muted lg:block" />

      <div class="min-w-0 flex-1">
        <p class="text-[10.5px] font-semibold uppercase tracking-[0.05em] text-muted">То</p>
        <ul class="mt-1 flex flex-col gap-0.5">
          <li v-for="a in rule.actions" :key="a.id" class="flex items-start gap-1.5 text-[12.5px] text-ink">
            <Icon :name="ACTION_META[a.kind].icon" size="13" class="mt-0.5 shrink-0" :style="{ color: accent }" />
            <span class="min-w-0">{{ actionLabel(a, userName) }}</span>
          </li>
        </ul>
      </div>
    </div>

    <footer class="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <p class="text-[11.5px] text-muted">
        Сработало <b class="tabular text-ink">{{ rule.runs }}</b>
        <template v-if="rule.lastRunAt"> · последний раз {{ fmtDateTime(rule.lastRunAt) }}</template>
      </p>
      <div class="ml-auto flex flex-wrap gap-1.5">
        <AppButton size="sm" icon="ph:sliders-horizontal" @click="emit('edit')">Настроить</AppButton>
        <AppButton size="sm" icon="ph:copy" title="Сделать копию правила" @click="emit('duplicate')" />
        <AppButton
          v-if="!rule.builtin" size="sm" icon="ph:trash" title="Удалить правило"
          @click="emit('remove')"
        />
      </div>
    </footer>
  </article>
</template>
