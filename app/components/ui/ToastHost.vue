<script setup lang="ts">
import type { Toast } from '~/stores/ui'

const ui = useUiStore()

const icon: Record<Toast['kind'], string> = { ok: 'ph:check-circle-fill', warn: 'ph:warning-fill', bad: 'ph:x-circle-fill', info: 'ph:info-fill' }
const tone: Record<Toast['kind'], string> = { ok: 'text-ok', warn: 'text-warn', bad: 'text-bad', info: 'text-info' }
</script>

<template>
  <Teleport to="body">
    <div class="pointer-events-none fixed inset-x-0 bottom-5 z-[90] flex flex-col items-center gap-2">
      <TransitionGroup enter-active-class="animate-toast-in">
        <div
          v-for="t in ui.toasts" :key="t.id"
          class="pointer-events-auto flex max-w-[90vw] items-center gap-2 rounded-xl2 border border-line bg-panel px-4 py-2.5 shadow-panel"
        >
          <Icon :name="icon[t.kind]" :class="tone[t.kind]" size="17" />
          <span class="text-[13.5px] font-medium text-ink">{{ t.text }}</span>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>
