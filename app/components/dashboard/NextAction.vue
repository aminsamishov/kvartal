<script setup lang="ts">
import type { AgendaItem } from '~/utils/agenda'
import { AGENDA_KIND_META } from '~/utils/agenda'

/**
 * Главный вопрос утра — не «сколько у меня дел», а «что прямо сейчас». Одно
 * ближайшее дело крупно, с обратным отсчётом и действиями: открыть заявку,
 * закрыть задачу, позвонить. Всё остальное на дашборде подчинено этому блоку.
 */
const props = defineProps<{
  item: AgendaItem | null
  doneCount: number
  total: number
}>()

const emit = defineEmits<{ open: [AgendaItem]; complete: [AgendaItem]; plan: [] }>()

const now = ref(new Date())
useIntervalFn(() => { now.value = new Date() }, 30_000)

const percent = computed(() => (props.total ? Math.round((props.doneCount / props.total) * 100) : 100))

const time = computed(() => (props.item
  ? new Date(props.item.at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  : '—'))

/** Обратный отсчёт словами: «через 40 мин» читается быстрее, чем «14:30». */
const countdown = computed(() => {
  if (!props.item) return ''
  const diff = Math.round((new Date(props.item.at).getTime() - now.value.getTime()) / 60000)
  const abs = Math.abs(diff)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  const span = h ? `${h} ч${m ? ` ${m} мин` : ''}` : `${m} мин`
  if (diff <= -1) return `просрочено на ${span}`
  if (diff <= 1) return 'началось'
  return `через ${span}`
})

const late = computed(() => !!props.item && new Date(props.item.at) < now.value)
const color = computed(() => (props.item ? AGENDA_KIND_META[props.item.kind].color : 'var(--muted)'))
</script>

<template>
  <section class="overflow-hidden rounded-card border border-line bg-panel shadow-card">
    <header class="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
      <p class="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
        {{ item ? 'Ближайшее дело' : 'План на сегодня' }}
      </p>
      <div class="flex items-center gap-2">
        <span class="tabular text-[11.5px] text-muted">закрыто {{ doneCount }} из {{ total }}</span>
        <span class="h-1.5 w-[86px] overflow-hidden rounded-full bg-soft">
          <span class="block h-full rounded-full bg-fill-ok transition-[width] duration-500" :style="{ width: `${percent}%` }" />
        </span>
      </div>
    </header>

    <div v-if="item" class="flex flex-wrap items-center gap-x-4 gap-y-3 p-4">
      <div class="flex min-w-0 flex-1 items-center gap-3.5">
        <span
          class="grid h-[54px] w-[54px] shrink-0 place-items-center rounded-card"
          :style="{ background: `color-mix(in srgb, ${color} 13%, transparent)`, color }"
        ><Icon :name="item.icon" size="24" /></span>

        <div class="min-w-0">
          <p class="flex flex-wrap items-baseline gap-x-2">
            <span class="text-[26px] font-semibold leading-none tracking-[-0.03em] text-ink">{{ item.allDay ? 'Сегодня' : time }}</span>
            <span class="text-[12.5px] font-semibold" :class="late ? 'text-bad' : 'text-muted'">{{ countdown }}</span>
          </p>
          <p class="mt-1 truncate text-[14px] font-medium text-ink">{{ item.title }}</p>
          <p v-if="item.subtitle" class="truncate text-[12px] text-muted">{{ item.subtitle }}</p>
        </div>
      </div>

      <div class="flex shrink-0 flex-wrap items-center gap-2">
        <AppButton v-if="item.taskId" icon="ph:check-bold" @click="emit('complete', item)">Выполнено</AppButton>
        <AppButton variant="primary" icon="ph:arrow-right" @click="emit('open', item)">Открыть</AppButton>
      </div>
    </div>

    <div v-else class="flex flex-wrap items-center gap-4 p-4">
      <span class="grid h-[54px] w-[54px] shrink-0 place-items-center rounded-card bg-ok-bg text-ok">
        <Icon name="ph:check-circle" size="26" />
      </span>
      <div class="min-w-0 flex-1">
        <p class="text-[15px] font-semibold tracking-[-0.015em] text-ink">
          {{ total ? 'Все дела на сегодня закрыты' : 'На сегодня дел не запланировано' }}
        </p>
        <p class="mt-0.5 text-[12.5px] text-muted">
          {{ total ? 'Поставьте следующий шаг по заявкам, чтобы они не зависли' : 'Заявка без следующего шага быстро остывает' }}
        </p>
      </div>
      <AppButton icon="ph:plus-bold" @click="emit('plan')">Запланировать</AppButton>
    </div>
  </section>
</template>
