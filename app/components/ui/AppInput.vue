<script setup lang="ts">
const props = withDefaults(defineProps<{
  modelValue?: string | number
  label?: string
  hint?: string
  placeholder?: string
  type?: string
  icon?: string
  suffix?: string
  disabled?: boolean
  error?: string
}>(), { type: 'text' })

defineEmits<{ 'update:modelValue': [string] }>()
void props
</script>

<template>
  <label class="flex flex-col gap-1.5 text-[12.5px] font-medium text-muted">
    <span v-if="label">{{ label }}</span>
    <span class="relative flex items-center">
      <Icon v-if="icon" :name="icon" size="16" class="pointer-events-none absolute left-3 text-muted" />
      <input
        :value="modelValue"
        :type="type"
        :placeholder="placeholder"
        :disabled="disabled"
        class="focus-ring h-10 w-full rounded-xl2 border border-line bg-panel text-[14px] font-normal text-ink placeholder:text-muted/70 disabled:opacity-50"
        :class="[icon ? 'pl-9 pr-3' : 'px-3', suffix ? 'pr-12' : '', error ? 'border-bad' : '']"
        @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      >
      <span v-if="suffix" class="absolute right-3 text-[12.5px] text-muted">{{ suffix }}</span>
    </span>
    <span v-if="error" class="text-[12px] font-normal text-bad">{{ error }}</span>
    <span v-else-if="hint" class="text-[12px] font-normal text-muted">{{ hint }}</span>
  </label>
</template>
