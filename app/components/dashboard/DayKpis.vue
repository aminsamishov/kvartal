<script setup lang="ts">
/**
 * KPI дня — одна полоса, а не набор карточек. Цифры отвечают на вопрос
 * «что со мной сегодня», поэтому их набор зависит от роли, а вёрстка — нет.
 */
export interface DayKpi {
  key: string
  label: string
  value: string
  hint?: string
  tone?: 'ok' | 'warn' | 'bad'
  to?: string
}

defineProps<{ items: DayKpi[] }>()
</script>

<template>
  <section class="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line shadow-card sm:grid-cols-3 lg:grid-cols-6">
    <component
      :is="k.to ? 'NuxtLink' : 'div'" v-for="k in items" :key="k.key" :to="k.to"
      class="group bg-panel px-4 py-3 transition-colors" :class="k.to ? 'hover:bg-soft' : ''"
    >
      <p class="flex items-center gap-1 text-[10.5px] uppercase tracking-[0.04em] text-muted">
        {{ k.label }}
        <Icon v-if="k.to" name="ph:arrow-up-right" size="11" class="opacity-0 transition-opacity group-hover:opacity-100" />
      </p>
      <p
        class="tabular mt-0.5 truncate text-[20px] font-semibold tracking-[-0.025em]"
        :class="k.tone === 'ok' ? 'text-ok' : k.tone === 'warn' ? 'text-warn' : k.tone === 'bad' ? 'text-bad' : 'text-ink'"
      >{{ k.value }}</p>
      <p v-if="k.hint" class="truncate text-[11px] text-muted">{{ k.hint }}</p>
    </component>
  </section>
</template>
