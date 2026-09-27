<script setup lang="ts">
/**
 * Контекстное меню строки. Правый клик — самый короткий путь к действию,
 * которое иначе требует открыть карточку и найти кнопку: позвонить,
 * забронировать, добавить оплату.
 */
export interface ContextAction {
  key: string
  label: string
  icon?: string
  /** подпись справа: горячая клавиша или подсказка */
  hint?: string
  danger?: boolean
  disabled?: boolean
  /** разделитель перед пунктом */
  separated?: boolean
}

const props = defineProps<{
  /** координаты клика во вьюпорте; null — меню закрыто */
  x: number | null
  y: number | null
  actions: ContextAction[]
  title?: string
}>()
const emit = defineEmits<{ pick: [string]; close: [] }>()

const open = computed(() => props.x !== null && props.y !== null)

const W = 224
const menuRef = ref<HTMLElement | null>(null)
const cursor = ref(-1)

const enabled = computed(() => props.actions.filter((a) => !a.disabled))

const style = computed(() => {
  const pad = 10
  const h = 12 + props.actions.length * 32 + (props.title ? 28 : 0)
  const vw = import.meta.client ? window.innerWidth : 1440
  const vh = import.meta.client ? window.innerHeight : 900
  let left = props.x ?? 0
  let top = props.y ?? 0
  if (left + W + pad > vw) left = Math.max(pad, left - W)
  if (top + h + pad > vh) top = Math.max(pad, vh - h - pad)
  return { left: `${left}px`, top: `${top}px`, width: `${W}px` }
})

onClickOutside(menuRef, () => emit('close'))

function pick(action: ContextAction) {
  if (action.disabled) return
  emit('pick', action.key)
  emit('close')
}

function onKey(e: KeyboardEvent) {
  if (!open.value) return
  if (e.key === 'Escape') { emit('close'); return }
  if (e.key === 'ArrowDown') { e.preventDefault(); cursor.value = (cursor.value + 1) % enabled.value.length }
  if (e.key === 'ArrowUp') { e.preventDefault(); cursor.value = (cursor.value - 1 + enabled.value.length) % enabled.value.length }
  if (e.key === 'Enter' && cursor.value >= 0) { e.preventDefault(); pick(enabled.value[cursor.value]!) }
}

watch(open, (v) => { if (v) cursor.value = -1 })
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <Transition appear enter-active-class="animate-pop-in">
      <div
        v-if="open" ref="menuRef"
        class="fixed z-[90] overflow-hidden rounded-card border border-line bg-panel py-1 shadow-pop"
        :style="style"
      >
        <p v-if="title" class="truncate px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted">
          {{ title }}
        </p>
        <template v-for="a in actions" :key="a.key">
          <span v-if="a.separated" class="my-1 block h-px bg-line" />
          <button
            type="button"
            class="focus-ring flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[12.5px] transition-colors disabled:opacity-40"
            :class="[
              a.danger ? 'text-bad hover:bg-bad-bg' : 'text-ink hover:bg-soft',
              enabled[cursor]?.key === a.key ? (a.danger ? 'bg-bad-bg' : 'bg-soft') : '',
            ]"
            :disabled="a.disabled"
            @click="pick(a)"
          >
            <Icon v-if="a.icon" :name="a.icon" size="14" class="shrink-0" :class="a.danger ? 'text-bad' : 'text-muted'" />
            <span class="min-w-0 flex-1 truncate">{{ a.label }}</span>
            <kbd v-if="a.hint" class="shrink-0 rounded border border-line bg-soft px-1 text-[10px] font-semibold text-muted">{{ a.hint }}</kbd>
          </button>
        </template>
      </div>
    </Transition>
  </Teleport>
</template>
