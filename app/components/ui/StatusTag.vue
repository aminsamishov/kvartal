<script setup lang="ts">
withDefaults(defineProps<{
  tone?: 'ok' | 'warn' | 'bad' | 'info' | 'neutral' | 'plum'
  icon?: string
  size?: 'sm' | 'md'
  dot?: boolean
}>(), { tone: 'neutral', size: 'md' })

const toneClass: Record<string, string> = {
  ok: 'bg-ok-bg text-ok',
  warn: 'bg-warn-bg text-warn',
  bad: 'bg-bad-bg text-bad',
  info: 'bg-info-bg text-info',
  neutral: 'bg-soft text-muted',
  plum: 'bg-plum-soft text-plum',
}
const dotClass: Record<string, string> = {
  ok: 'bg-ok', warn: 'bg-warn', bad: 'bg-bad', info: 'bg-info', neutral: 'bg-muted', plum: 'bg-plum',
}
</script>

<template>
  <span
    class="inline-flex items-center gap-1 rounded-full font-semibold"
    :class="[toneClass[tone], size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-[12.5px]']"
  >
    <span v-if="dot" class="h-1.5 w-1.5 rounded-full" :class="dotClass[tone]" />
    <Icon v-if="icon" :name="icon" size="13" />
    <slot />
  </span>
</template>
