<script setup lang="ts">
const props = withDefaults(defineProps<{
  modelValue: boolean
  title?: string
  width?: 'sm' | 'md' | 'lg' | 'xl'
}>(), { width: 'md' })

const emit = defineEmits<{ 'update:modelValue': [boolean] }>()

function close() {
  emit('update:modelValue', false)
}

const widthClass = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-[1180px]' }
void props
</script>

<template>
  <Teleport to="body">
    <Transition enter-active-class="transition-opacity duration-150" leave-active-class="transition-opacity duration-150" enter-from-class="opacity-0" leave-to-class="opacity-0">
      <div v-if="modelValue" class="fixed inset-0 z-[70] grid place-items-center bg-ink/40 p-4" @mousedown.self="close">
        <Transition appear enter-active-class="animate-pop-in">
          <div class="max-h-[88vh] w-full overflow-auto rounded-card border border-line bg-panel shadow-panel" :class="widthClass[width]">
            <header v-if="title" class="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
              <h3 class="text-[15px] font-semibold tracking-[-0.015em]">{{ title }}</h3>
              <button class="focus-ring grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-soft" @click="close">
                <Icon name="ph:x" size="17" />
              </button>
            </header>
            <div class="p-5">
              <slot />
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
