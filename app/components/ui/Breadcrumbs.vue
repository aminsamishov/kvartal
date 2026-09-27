<script setup lang="ts">
defineProps<{ items: { label: string; to?: string }[] }>()
</script>

<template>
  <nav class="flex min-w-0 items-center gap-1.5 text-[13px] text-muted">
    <template v-for="(item, i) in items" :key="i">
      <NuxtLink v-if="item.to && i !== items.length - 1" :to="item.to" class="truncate hover:text-ink">{{ item.label }}</NuxtLink>
      <span v-else class="truncate font-semibold text-ink">{{ item.label }}</span>
      <Icon v-if="i !== items.length - 1" name="ph:caret-right" size="12" class="shrink-0 opacity-60" />
    </template>
  </nav>
</template>
