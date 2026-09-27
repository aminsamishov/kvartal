<script setup lang="ts">
withDefaults(defineProps<{
  icon?: string
  title: string
  text?: string
  compact?: boolean
}>(), { icon: 'ph:folder-open-duotone' })
</script>

<template>
  <div class="flex flex-col items-center rounded-card border border-dashed border-line text-center" :class="compact ? 'gap-2 px-4 py-8' : 'gap-3 px-6 py-14'">
    <div class="grid place-items-center rounded-full bg-plum-soft text-plum" :class="compact ? 'h-12 w-12' : 'h-16 w-16'">
      <Icon :name="icon" :size="compact ? '26' : '34'" />
    </div>
    <div>
      <p class="text-[14.5px] font-semibold tracking-[-0.015em] text-ink">{{ title }}</p>
      <p v-if="text" class="mx-auto mt-1 max-w-sm text-[13px] text-muted">{{ text }}</p>
    </div>
    <div v-if="$slots.action" class="mt-1">
      <slot name="action" />
    </div>
  </div>
</template>
