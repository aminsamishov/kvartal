<script setup lang="ts">
// Шапка страницы. Заголовки набраны основным шрифтом, а не Unbounded:
// геометрический дисплейный шрифт на каждом заголовке читается как приём
// презентации, а не как рабочий интерфейс. Unbounded остался только в логотипе.
defineProps<{ title: string; subtitle?: string; eyebrow?: string }>()
</script>

<template>
  <header class="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
    <div class="min-w-0">
      <p v-if="eyebrow" class="mb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">{{ eyebrow }}</p>
      <h1 class="text-[22px] font-semibold leading-tight tracking-[-0.025em] text-ink">{{ title }}</h1>
      <p v-if="subtitle" class="mt-1 text-[13px] text-muted">{{ subtitle }}</p>
      <slot name="meta" />
    </div>
    <div v-if="$slots.actions" class="flex shrink-0 flex-wrap items-center gap-2">
      <slot name="actions" />
    </div>
  </header>
</template>
