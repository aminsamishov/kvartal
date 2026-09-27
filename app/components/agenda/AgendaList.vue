<script setup lang="ts">
import type { AgendaItem } from '~/utils/agenda'

/**
 * Список повестки с пустым состоянием. Отдельный компонент, потому что
 * «Показы сегодня», «Платежи сегодня» и «Просрочки» — один и тот же список
 * с разным фильтром, а не три разные панели.
 */
withDefaults(defineProps<{
  items: AgendaItem[]
  emptyTitle?: string
  emptyText?: string
  emptyIcon?: string
  limit?: number
  compact?: boolean
}>(), { emptyTitle: 'Пусто', emptyIcon: 'ph:check-circle', limit: 0 })

const emit = defineEmits<{ done: [AgendaItem]; open: [AgendaItem] }>()
</script>

<template>
  <div v-if="items.length" class="-mx-2 flex flex-col">
    <AgendaRow
      v-for="i in (limit ? items.slice(0, limit) : items)" :key="i.id" :item="i" :compact="compact"
      @done="emit('done', $event)" @open="emit('open', $event)"
    />
    <p v-if="limit && items.length > limit" class="px-2 pt-1 text-[11.5px] text-muted">
      и ещё {{ items.length - limit }}
    </p>
  </div>
  <EmptyState v-else compact :icon="emptyIcon" :title="emptyTitle" :text="emptyText" />
</template>
