<script setup lang="ts">
withDefaults(defineProps<{
  title?: string
  subtitle?: string
  padded?: boolean
  flush?: boolean
}>(), { padded: true })
</script>

<template>
  <section class="rounded-card border border-line bg-panel shadow-card" :class="padded ? 'p-5' : ''">
    <header v-if="title || $slots.actions" class="mb-4 flex items-start justify-between gap-3" :class="flush ? 'px-5 pt-5' : ''">
      <div>
        <h2 v-if="title" class="text-[14px] font-semibold tracking-[-0.01em] text-ink">{{ title }}</h2>
        <p v-if="subtitle" class="mt-1 text-[12.5px] leading-snug text-muted">{{ subtitle }}</p>
      </div>
      <div v-if="$slots.actions" class="flex shrink-0 items-center gap-2">
        <slot name="actions" />
      </div>
    </header>
    <slot />
  </section>
</template>
