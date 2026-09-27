<script setup lang="ts">
withDefaults(defineProps<{
  variant?: 'primary' | 'default' | 'ghost' | 'danger' | 'dark'
  size?: 'sm' | 'md'
  icon?: string
  iconRight?: string
  loading?: boolean
  disabled?: boolean
  type?: 'button' | 'submit'
  block?: boolean
}>(), {
  variant: 'default',
  size: 'md',
  type: 'button',
})

defineEmits<{ click: [MouseEvent] }>()

const variantClass: Record<string, string> = {
  primary: 'bg-fill-plum text-white border-fill-plum hover:bg-fill-plum-dark shadow-[0_1px_2px_rgba(0,0,0,.05),0_1px_10px_-3px_var(--fill-plum)]',
  default: 'bg-panel text-ink border-line hover:bg-soft hover:border-line shadow-card',
  ghost: 'bg-transparent text-ink border-transparent hover:bg-soft',
  danger: 'bg-fill-bad text-white border-fill-bad hover:opacity-90',
  dark: 'bg-ink text-panel border-ink hover:opacity-90',
}
</script>

<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    class="focus-ring inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl2 border font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
    :class="[
      variantClass[variant],
      size === 'sm' ? 'h-8 px-3 text-[13px]' : 'h-10 px-4 text-[14px]',
      block ? 'w-full' : '',
    ]"
    @click="$emit('click', $event)"
  >
    <Icon v-if="loading" name="ph:spinner-gap" class="animate-spin" :size="size === 'sm' ? '15' : '17'" />
    <Icon v-else-if="icon" :name="icon" :size="size === 'sm' ? '15' : '17'" />
    <slot />
    <Icon v-if="iconRight" :name="iconRight" :size="size === 'sm' ? '15' : '17'" />
  </button>
</template>
