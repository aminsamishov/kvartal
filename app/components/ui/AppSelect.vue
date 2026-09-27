<script setup lang="ts">
withDefaults(defineProps<{
  modelValue?: string | number
  label?: string
  options: { value: string | number; label: string }[]
  placeholder?: string
}>(), {})

defineEmits<{ 'update:modelValue': [string] }>()
</script>

<template>
  <label class="flex flex-col gap-1.5 text-[12.5px] font-medium text-muted">
    <span v-if="label">{{ label }}</span>
    <span class="relative flex items-center">
      <select
        :value="modelValue"
        class="focus-ring h-10 w-full appearance-none rounded-xl2 border border-line bg-panel px-3 pr-9 text-[14px] font-normal text-ink"
        @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
      >
        <option v-if="placeholder" value="" disabled selected hidden>{{ placeholder }}</option>
        <option v-for="opt in options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
      </select>
      <Icon name="ph:caret-down" size="14" class="pointer-events-none absolute right-3 text-muted" />
    </span>
  </label>
</template>
