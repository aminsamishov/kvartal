<script setup lang="ts">
import { initials } from '~/utils/format'

withDefaults(defineProps<{ name: string; color?: string; size?: 'sm' | 'md' | 'lg' }>(), { color: '#6E4453', size: 'md' })
const sizeClass = { sm: 'h-6 w-6 text-[10px]', md: 'h-8 w-8 text-[12px]', lg: 'h-11 w-11 text-[14px]' }
</script>

<template>
  <span class="grid shrink-0 place-items-center rounded-full font-bold text-white" :class="sizeClass[size]" :style="{ background: color }">
    {{ initials(name) }}
  </span>
</template>
