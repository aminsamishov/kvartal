<script setup lang="ts">
import type { AgendaItem } from '~/utils/agenda'
import { AGENDA_KIND_META } from '~/utils/agenda'
import { money } from '~/utils/format'

/**
 * Строка повестки: время, что за дело, по кому и действие. Одна и та же и на
 * дашборде, и в календаре — менеджер не должен переучиваться, переходя из
 * ленты дня в неделю.
 */
const props = defineProps<{ item: AgendaItem; compact?: boolean }>()
const emit = defineEmits<{ done: [AgendaItem]; open: [AgendaItem] }>()

const time = computed(() => new Date(props.item.at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }))
const color = computed(() => AGENDA_KIND_META[props.item.kind].color)

const TONE_TEXT: Record<AgendaItem['tone'], string> = {
  ok: 'text-ok', warn: 'text-warn', bad: 'text-bad', info: 'text-info', neutral: 'text-ink',
}
</script>

<template>
  <div
    class="group flex items-start gap-2.5 rounded-xl2 px-2 py-1.5 transition-colors hover:bg-soft"
    :class="item.done ? 'opacity-60' : ''"
  >
    <span class="tabular w-[38px] shrink-0 pt-0.5 text-[11.5px] font-semibold text-muted">{{ time }}</span>
    <span
      class="grid h-7 w-7 shrink-0 place-items-center rounded-lg"
      :style="{ background: `color-mix(in srgb, ${color} 15%, transparent)`, color }"
    ><Icon :name="item.icon" size="14" /></span>

    <div class="min-w-0 flex-1">
      <p class="truncate text-[12.5px] font-medium" :class="[TONE_TEXT[item.tone], item.done ? 'line-through' : '']">
        {{ item.title }}
      </p>
      <p v-if="item.subtitle && !compact" class="truncate text-[11.5px] text-muted">{{ item.subtitle }}</p>
    </div>

    <span v-if="item.overdue && !item.done" class="shrink-0 rounded-full bg-bad-bg px-1.5 py-0.5 text-[10.5px] font-bold text-bad">просрочено</span>
    <span v-else-if="item.amount && !compact" class="tabular shrink-0 text-[12px] font-semibold text-ink">{{ money(item.amount) }}</span>

    <div class="flex shrink-0 items-center gap-0.5">
      <button
        v-if="item.taskId && !item.done"
        class="focus-ring grid h-7 w-7 place-items-center rounded-lg text-muted opacity-0 transition-opacity hover:text-ok group-hover:opacity-100"
        title="Отметить выполненной" @click.stop="emit('done', item)"
      ><Icon name="ph:check-circle" size="15" /></button>
      <button
        v-if="item.to"
        class="focus-ring grid h-7 w-7 place-items-center rounded-lg text-muted opacity-0 transition-opacity hover:text-plum group-hover:opacity-100"
        title="Открыть" @click.stop="emit('open', item)"
      ><Icon name="ph:arrow-square-out" size="14" /></button>
    </div>
  </div>
</template>
