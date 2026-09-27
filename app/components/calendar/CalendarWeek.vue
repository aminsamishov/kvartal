<script setup lang="ts">
import type { AgendaItem } from '~/utils/agenda'
import { AGENDA_KIND_META, addDays, dayKey } from '~/utils/agenda'

/**
 * Неделя семью колонками. Внутри дня — компактные строки: в недельном
 * масштабе важен не час, а плотность и то, где день перегружен.
 */
const props = defineProps<{ items: AgendaItem[]; from: Date }>()
const emit = defineEmits<{ open: [AgendaItem]; pickDay: [Date] }>()

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

const days = computed(() => Array.from({ length: 7 }, (_, i) => {
  const date = addDays(props.from, i)
  const key = dayKey(date)
  const items = props.items.filter((x) => dayKey(x.at) === key)
  return {
    date, key, items,
    weekday: WEEKDAYS[i]!,
    today: dayKey(new Date()) === key,
    weekend: i >= 5,
  }
}))
</script>

<template>
  <div class="grid grid-cols-1 gap-px overflow-hidden rounded-card border border-line bg-line sm:grid-cols-7">
    <section
      v-for="d in days" :key="d.key"
      class="flex min-h-[260px] flex-col bg-panel"
      :class="d.weekend ? 'bg-soft/40' : ''"
    >
      <header
        class="flex items-baseline justify-between gap-1 border-b border-line px-2.5 py-2"
        :class="d.today ? 'bg-plum-soft' : ''"
      >
        <button type="button" class="focus-ring text-left" @click="emit('pickDay', d.date)">
          <p class="text-[11px] uppercase tracking-[0.04em] text-muted">{{ d.weekday }}</p>
          <p class="tabular text-[15px] font-semibold" :class="d.today ? 'text-plum' : 'text-ink'">
            {{ d.date.getDate() }}
          </p>
        </button>
        <span v-if="d.items.length" class="tabular rounded-full bg-soft px-1.5 text-[10.5px] font-semibold text-ink">
          {{ d.items.length }}
        </span>
      </header>

      <div class="flex flex-1 flex-col gap-1 p-1.5">
        <button
          v-for="item in d.items" :key="item.id" type="button"
          class="focus-ring flex items-start gap-1.5 rounded-lg px-1.5 py-1 text-left transition-colors hover:bg-soft"
          :class="item.done ? 'opacity-55' : ''"
          @click="emit('open', item)"
        >
          <span
            class="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full"
            :style="{ background: AGENDA_KIND_META[item.kind].color }"
          />
          <span class="min-w-0 flex-1">
            <span class="tabular mr-1 text-[10.5px] font-semibold text-muted">
              {{ new Date(item.at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) }}
            </span>
            <span class="text-[11.5px] leading-tight text-ink" :class="item.done ? 'line-through' : ''">{{ item.title }}</span>
          </span>
        </button>
        <p v-if="!d.items.length" class="px-1.5 py-1 text-[11px] text-muted">—</p>
      </div>
    </section>
  </div>
</template>
