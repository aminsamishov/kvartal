<script setup lang="ts">
withDefaults(defineProps<{
  modelValue: boolean
  title?: string
  subtitle?: string
  width?: string
}>(), { width: '480px' })

const emit = defineEmits<{ 'update:modelValue': [boolean] }>()
function close() {
  emit('update:modelValue', false)
}
</script>

<template>
  <Teleport to="body">
    <Transition enter-active-class="transition-opacity duration-200" leave-active-class="transition-opacity duration-150" enter-from-class="opacity-0" leave-to-class="opacity-0">
      <div v-if="modelValue" class="fixed inset-0 z-[70] bg-ink/35" @mousedown.self="close">
        <Transition
          enter-active-class="transition-transform duration-220 ease-out" leave-active-class="transition-transform duration-160 ease-in"
          enter-from-class="translate-x-full" leave-to-class="translate-x-full"
        >
          <aside v-if="modelValue" class="fixed inset-y-0 right-0 flex h-full flex-col border-l border-line bg-panel shadow-panel" :style="{ width }">
            <header class="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
              <div class="min-w-0">
                <h3 v-if="title" class="truncate text-[16px] font-semibold tracking-[-0.02em]">{{ title }}</h3>
                <p v-if="subtitle" class="mt-0.5 truncate text-[12.5px] text-muted">{{ subtitle }}</p>
              </div>
              <button class="focus-ring grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-soft" @click="close">
                <Icon name="ph:x" size="17" />
              </button>
            </header>
            <div class="flex-1 overflow-y-auto px-5 py-4">
              <slot />
            </div>
            <footer v-if="$slots.footer" class="border-t border-line px-5 py-3.5">
              <slot name="footer" />
            </footer>
          </aside>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
