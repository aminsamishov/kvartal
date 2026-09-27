<script setup lang="ts">
defineProps<{ pressed?: boolean; icon?: string }>()
defineEmits<{ click: [] }>()
</script>

<template>
  <button
    type="button"
    class="focus-ring inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors"
    :class="pressed ? 'border-ink bg-ink text-panel' : 'border-line bg-panel text-ink hover:bg-soft'"
    @click="$emit('click')"
  >
    <Icon v-if="icon" :name="icon" size="13" />
    <slot />
  </button>
</template>
