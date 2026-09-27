<script setup lang="ts">
defineProps<{ title: string; subtitle?: string; to?: string; linkLabel?: string }>()
</script>

<template>
  <div class="mb-3 flex flex-wrap items-end justify-between gap-3">
    <div class="min-w-0">
      <h2 class="text-[15px] font-semibold tracking-[-0.015em] text-ink">{{ title }}</h2>
      <p v-if="subtitle" class="mt-0.5 text-[12.5px] text-muted">{{ subtitle }}</p>
    </div>
    <div class="flex shrink-0 items-center gap-2">
      <slot name="actions" />
      <NuxtLink v-if="to" :to="to" class="flex items-center gap-1 text-[12.5px] font-semibold text-plum hover:underline">
        {{ linkLabel ?? 'Смотреть все' }} <Icon name="ph:arrow-right" size="13" />
      </NuxtLink>
    </div>
  </div>
</template>
