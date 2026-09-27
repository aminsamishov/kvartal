<script setup lang="ts">
defineProps<{ options: { value: string; label: string; icon?: string }[]; modelValue: string }>()
defineEmits<{ 'update:modelValue': [string] }>()
</script>

<template>
  <div class="inline-flex rounded-xl2 border border-line bg-panel p-0.5">
    <button
      v-for="opt in options" :key="opt.value" type="button"
      class="focus-ring flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-[13px] font-semibold transition-colors"
      :class="modelValue === opt.value ? 'bg-ink text-panel' : 'text-muted hover:text-ink'"
      @click="$emit('update:modelValue', opt.value)"
    >
      <Icon v-if="opt.icon" :name="opt.icon" size="14" />
      {{ opt.label }}
    </button>
  </div>
</template>
