<script setup lang="ts">
withDefaults(defineProps<{ percent: number; tone?: 'ok' | 'plum' | 'warn'; showLabel?: boolean }>(), { tone: 'ok', showLabel: true })
const toneClass: Record<string, string> = { ok: 'bg-ok', plum: 'bg-plum', warn: 'bg-warn' }
</script>

<template>
  <div class="flex items-center gap-2.5">
    <div class="h-[7px] flex-1 overflow-hidden rounded-full bg-soft">
      <div class="h-full rounded-full transition-all" :class="toneClass[tone]" :style="{ width: `${Math.min(100, Math.max(0, percent))}%` }" />
    </div>
    <b v-if="showLabel" class="tabular w-9 shrink-0 text-right text-[12.5px] font-semibold text-ink">{{ Math.round(percent) }}%</b>
  </div>
</template>
