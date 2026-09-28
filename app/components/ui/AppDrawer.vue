<script setup lang="ts">
const props = withDefaults(defineProps<{
  modelValue: boolean
  title?: string
  subtitle?: string
  width?: string
  /**
   * Пристыкованная панель вместо модальной: страница под неё сжимается,
   * затемнения нет, и с тем, что осталось видно, можно работать дальше.
   *
   * Для шахматки это принципиально: менеджер открывает квартиру, но продолжает
   * водить по соседним — модальная карточка поверх затемнения каждый раз
   * заставляла её закрывать, чтобы увидеть, что рядом.
   */
  docked?: boolean
  /** ширина пристыкованной панели — уже модальной, место нужно и содержимому */
  dockedWidth?: string
}>(), { width: '480px', docked: false, dockedWidth: 'clamp(360px, 30vw, 500px)' })

const emit = defineEmits<{ 'update:modelValue': [boolean] }>()
function close() {
  emit('update:modelValue', false)
}

// на узком экране пристыковывать некуда — панель съела бы всё содержимое,
// поэтому там она остаётся модальной. 1280px — брейкпоинт xl, тот же, по
// которому раскладываются двухколоночные страницы
const wide = useMediaQuery('(min-width: 1280px)')
const asPanel = computed(() => props.docked && wide.value)
</script>

<template>
  <!-- disabled оставляет панель в потоке страницы: именно так она и раздвигает
       содержимое, а не ложится поверх него -->
  <Teleport to="body" :disabled="asPanel">
    <!--
      Появление — CSS-анимацией, а не <Transition>. Переходы Vue продвигаются
      через requestAnimationFrame: в фоновой вкладке он заморожен, уход не
      завершается, и панель зависала открытой — у пристыкованной это ещё и
      держало содержимое страницы сжатым. У анимации фазы ухода нет.
    -->
    <div
      v-if="modelValue && !asPanel"
      class="animate-fade-in fixed inset-0 z-[70] bg-ink/35"
      @mousedown.self="close"
    />

    <aside
      v-if="modelValue"
      class="flex flex-col border-line bg-panel"
      :class="asPanel
        ? 'animate-fade-in sticky top-20 max-h-[calc(100vh-96px)] shrink-0 overflow-hidden rounded-card border shadow-card'
        : 'animate-drawer-in fixed inset-y-0 right-0 z-[71] h-full border-l shadow-panel'"
      :style="{ width: asPanel ? dockedWidth : width }"
    >
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
  </Teleport>
</template>
