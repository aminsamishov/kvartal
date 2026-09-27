<script setup lang="ts">
defineProps<{ tabs: { value: string; label: string; icon?: string; count?: number }[]; modelValue: string }>()
defineEmits<{ 'update:modelValue': [string] }>()
</script>

<template>
  <div class="scrollbar-none flex gap-1 overflow-x-auto border-b border-line">
    <button
      v-for="tab in tabs" :key="tab.value" type="button"
      class="focus-ring relative flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3.5 py-2.5 text-[13px] font-medium transition-colors"
      :class="modelValue === tab.value ? 'text-ink' : 'text-muted hover:text-ink'"
      @click="$emit('update:modelValue', tab.value)"
    >
      <Icon v-if="tab.icon" :name="tab.icon" size="14.5" />
      {{ tab.label }}
      <span v-if="tab.count !== undefined" class="rounded-full px-1.5 py-0.5 text-[10.5px] tabular" :class="modelValue === tab.value ? 'bg-plum-soft text-plum' : 'bg-soft text-muted'">{{ tab.count }}</span>
      <span v-if="modelValue === tab.value" class="absolute inset-x-3.5 -bottom-px h-[2px] rounded-full bg-fill-plum" />
    </button>
  </div>
</template>
