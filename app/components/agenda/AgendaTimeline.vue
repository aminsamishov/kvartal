<script setup lang="ts">
import type { AgendaItem } from '~/utils/agenda'
import { AGENDA_KIND_META } from '~/utils/agenda'
import { money } from '~/utils/format'

/**
 * Лента дня с осью времени. Отличается от простого списка тем, что показывает
 * положение дел относительно «сейчас»: что уже прошло, что горит через час.
 * Плоский список этого не давал — менеджер читал его как очередь, а не как день.
 */
const props = withDefaults(defineProps<{
  items: AgendaItem[]
  /** ось «сейчас» рисуем только там, где лента действительно про сегодня */
  showNow?: boolean
  emptyTitle?: string
  emptyText?: string
  emptyIcon?: string
}>(), { showNow: true, emptyTitle: 'Дел нет', emptyIcon: 'ph:check-circle' })

const emit = defineEmits<{ done: [AgendaItem]; open: [AgendaItem] }>()

const now = ref(new Date())
useIntervalFn(() => { now.value = new Date() }, 60_000)

const PARTS = [
  { key: 'morning', label: 'Утро', to: 12 },
  { key: 'day', label: 'День', to: 17 },
  { key: 'evening', label: 'Вечер', to: 24 },
] as const

/**
 * Дела по половинам дня. Заголовок части — не украшение: «до обеда осталось
 * два звонка» менеджер держит в голове именно так.
 */
const groups = computed(() => {
  const out: { key: string; label: string; items: AgendaItem[] }[] = []
  let from = 0
  for (const part of PARTS) {
    const items = props.items.filter((i) => {
      const h = new Date(i.at).getHours()
      return h >= from && h < part.to
    })
    if (items.length) out.push({ key: part.key, label: part.label, items })
    from = part.to
  }
  return out
})

/** Перед каким делом встаёт метка «сейчас». */
const nowBefore = computed(() => {
  if (!props.showNow) return null
  const next = props.items.find((i) => new Date(i.at) > now.value)
  return next?.id ?? null
})
const nowPassed = computed(() => props.showNow && props.items.length > 0 && !nowBefore.value)
const nowLabel = computed(() => now.value.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }))

function hhmm(iso: string) {
  return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

const TONE_TEXT: Record<AgendaItem['tone'], string> = {
  ok: 'text-ok', warn: 'text-warn', bad: 'text-bad', info: 'text-ink', neutral: 'text-ink',
}
</script>

<template>
  <div v-if="items.length" class="relative">
    <!-- ось: одна линия на всю ленту, к ней крепятся точки дел -->
    <span class="absolute bottom-2 left-[52px] top-2 w-px bg-line" aria-hidden="true" />

    <div v-for="g in groups" :key="g.key" class="relative">
      <p class="py-1.5 pl-[64px] text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted">{{ g.label }}</p>

      <template v-for="i in g.items" :key="i.id">
        <div v-if="nowBefore === i.id" class="relative flex items-center gap-2 py-1">
          <span class="tabular w-[40px] shrink-0 text-right text-[10.5px] font-bold text-bad">{{ nowLabel }}</span>
          <span class="h-[7px] w-[7px] shrink-0 rounded-full bg-fill-bad" />
          <span class="h-px flex-1 bg-fill-bad/45" />
        </div>

        <button
          type="button"
          class="group relative flex w-full items-start gap-2 rounded-xl2 py-1 pr-1 text-left transition-colors hover:bg-soft"
          :class="i.done ? 'opacity-60' : ''"
          @click="emit('open', i)"
        >
          <span class="tabular w-[40px] shrink-0 pt-[9px] text-right text-[11.5px] font-semibold text-muted">
            {{ i.allDay ? '—' : hhmm(i.at) }}
          </span>
          <span
            class="mt-[13px] h-[9px] w-[9px] shrink-0 rounded-full ring-2 ring-panel"
            :style="{ background: AGENDA_KIND_META[i.kind].color }"
          />

          <span
            class="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl2 border border-line bg-panel px-2.5 py-2 transition-shadow group-hover:shadow-card"
            :style="i.overdue && !i.done ? { borderColor: 'color-mix(in srgb, var(--bad) 45%, transparent)' } : undefined"
          >
            <span
              class="grid h-7 w-7 shrink-0 place-items-center rounded-lg"
              :style="{
                background: `color-mix(in srgb, ${AGENDA_KIND_META[i.kind].color} 14%, transparent)`,
                color: AGENDA_KIND_META[i.kind].color,
              }"
            ><Icon :name="i.icon" size="14" /></span>

            <span class="min-w-0 flex-1">
              <span
                class="block truncate text-[13px] font-medium"
                :class="[TONE_TEXT[i.tone], i.done ? 'text-muted line-through' : '']"
              >{{ i.title }}</span>
              <span v-if="i.subtitle" class="block truncate text-[11.5px] text-muted">{{ i.subtitle }}</span>
            </span>

            <span v-if="i.overdue && !i.done" class="shrink-0 rounded-full bg-bad-bg px-1.5 py-0.5 text-[10.5px] font-bold text-bad">просрочено</span>
            <span v-else-if="i.amount" class="tabular shrink-0 text-[12.5px] font-semibold text-ink">{{ money(i.amount) }}</span>

            <span
              v-if="i.taskId && !i.done"
              class="focus-ring grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted opacity-0 transition-opacity hover:bg-ok-bg hover:text-ok group-hover:opacity-100"
              title="Отметить выполненной" @click.stop="emit('done', i)"
            ><Icon name="ph:check-bold" size="13" /></span>
            <Icon v-else name="ph:caret-right" size="13" class="shrink-0 text-muted" />
          </span>
        </button>
      </template>
    </div>

    <div v-if="nowPassed" class="relative flex items-center gap-2 pt-1">
      <span class="tabular w-[40px] shrink-0 text-right text-[10.5px] font-bold text-bad">{{ nowLabel }}</span>
      <span class="h-[7px] w-[7px] shrink-0 rounded-full bg-fill-bad" />
      <span class="h-px flex-1 bg-fill-bad/45" />
    </div>
  </div>

  <EmptyState v-else compact :icon="emptyIcon" :title="emptyTitle" :text="emptyText" />
</template>
