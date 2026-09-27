<script setup lang="ts">
import type { AgendaItem } from '~/utils/agenda'
import { AGENDA_KIND_META } from '~/utils/agenda'

/**
 * День по часам. Раскладываем дела по часовым полосам: менеджеру важно видеть
 * не список, а дыры между показами — в них и ставят следующую встречу.
 */
const props = defineProps<{ items: AgendaItem[]; date: Date }>()
const emit = defineEmits<{ open: [AgendaItem]; done: [AgendaItem] }>()

const FROM = 8
const TO = 21

const hours = computed(() => Array.from({ length: TO - FROM }, (_, i) => FROM + i))

const byHour = computed(() => {
  const map = new Map<number, AgendaItem[]>()
  for (const item of props.items) {
    const h = Math.min(TO - 1, Math.max(FROM, new Date(item.at).getHours()))
    const list = map.get(h) ?? []
    list.push(item)
    map.set(h, list)
  }
  return map
})

const isToday = computed(() => new Date().toDateString() === props.date.toDateString())
const nowHour = computed(() => new Date().getHours() + new Date().getMinutes() / 60)
</script>

<template>
  <div class="overflow-hidden rounded-card border border-line bg-panel">
    <div v-for="h in hours" :key="h" class="relative flex gap-3 border-b border-line last:border-0">
      <span class="tabular w-[54px] shrink-0 border-r border-line px-2 py-2 text-[11.5px] text-muted">
        {{ String(h).padStart(2, '0') }}:00
      </span>
      <div class="min-h-[46px] flex-1 py-1.5 pr-2">
        <div v-if="byHour.get(h)?.length" class="flex flex-col gap-1">
          <button
            v-for="item in byHour.get(h)" :key="item.id" type="button"
            class="focus-ring flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition-colors hover:shadow-card"
            :class="item.done ? 'opacity-60' : ''"
            :style="{
              borderColor: `color-mix(in srgb, ${AGENDA_KIND_META[item.kind].color} 45%, transparent)`,
              background: `color-mix(in srgb, ${AGENDA_KIND_META[item.kind].color} 9%, transparent)`,
            }"
            @click="emit('open', item)"
          >
            <Icon :name="item.icon" size="14" :style="{ color: AGENDA_KIND_META[item.kind].color }" class="shrink-0" />
            <span class="tabular shrink-0 text-[11px] font-semibold text-muted">
              {{ new Date(item.at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) }}
            </span>
            <span class="min-w-0 flex-1 truncate text-[12.5px] font-medium text-ink" :class="item.done ? 'line-through' : ''">
              {{ item.title }}
            </span>
            <span v-if="item.subtitle" class="hidden min-w-0 max-w-[40%] truncate text-[11.5px] text-muted sm:block">{{ item.subtitle }}</span>
            <span v-if="item.overdue && !item.done" class="shrink-0 rounded-full bg-bad-bg px-1.5 text-[10px] font-bold text-bad">просрочено</span>
            <span
              v-else-if="item.taskId && !item.done"
              class="focus-ring grid h-6 w-6 shrink-0 place-items-center rounded text-muted hover:text-ok"
              title="Отметить выполненной" @click.stop="emit('done', item)"
            ><Icon name="ph:check" size="13" /></span>
          </button>
        </div>
      </div>

      <!-- линия текущего времени: сразу видно, что уже прошло -->
      <span
        v-if="isToday && nowHour >= h && nowHour < h + 1"
        class="pointer-events-none absolute inset-x-0 z-10 flex items-center"
        :style="{ top: `${(nowHour - h) * 100}%` }"
      >
        <span class="ml-[52px] h-px flex-1 bg-bad/70" />
      </span>
    </div>
  </div>
</template>
