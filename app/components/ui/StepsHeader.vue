<script setup lang="ts">
defineProps<{ steps: string[]; current: number }>()
</script>

<template>
  <ol class="flex items-center gap-1.5">
    <li v-for="(step, i) in steps" :key="step" class="flex min-w-0 flex-1 items-center gap-1.5">
      <div class="flex min-w-0 items-center gap-2">
        <span
          class="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11.5px] font-bold tabular"
          :class="i < current ? 'bg-fill-ok text-white' : i === current ? 'bg-fill-plum text-white' : 'bg-soft text-muted'"
        >
          <Icon v-if="i < current" name="ph:check-bold" size="12" />
          <template v-else>{{ i + 1 }}</template>
        </span>
        <span class="truncate text-[13px] font-semibold" :class="i === current ? 'text-ink' : 'text-muted'">{{ step }}</span>
      </div>
      <span v-if="i !== steps.length - 1" class="h-px flex-1" :class="i < current ? 'bg-fill-ok' : 'bg-line'" />
    </li>
  </ol>
</template>
