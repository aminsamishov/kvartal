<script setup lang="ts">
// Переключатель. Раньше эти стили были скопированы в трёх компонентах —
// вынесены сюда, чтобы правка не разъезжалась по проекту.
defineProps<{ modelValue: boolean; label?: string; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [boolean] }>()
</script>

<template>
  <label class="flex cursor-pointer items-center justify-between gap-2 text-[12px]" :class="disabled ? 'opacity-50' : ''">
    <span v-if="label" class="text-muted">{{ label }}</span>
    <slot />
    <span class="switch">
      <input
        type="checkbox" :checked="modelValue" :disabled="disabled"
        @change="emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
      >
      <span />
    </span>
  </label>
</template>

<style scoped>
.switch { position: relative; width: 34px; height: 20px; flex-shrink: 0; display: inline-block; }
.switch input { opacity: 0; width: 100%; height: 100%; margin: 0; position: absolute; cursor: pointer; z-index: 1; }
.switch span { position: absolute; inset: 0; background: var(--line); border-radius: 99px; transition: .15s; pointer-events: none; }
.switch span::after { content: ""; position: absolute; left: 2px; top: 2px; width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: .15s; }
.switch input:checked + span { background: var(--fill-ok); }
.switch input:checked + span::after { left: 16px; }
</style>
