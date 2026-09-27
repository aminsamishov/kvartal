<script setup lang="ts">
// Липкая навигация по секциям панели. Заменяет вкладки: вся информация
// остаётся на одном полотне, но до нужного блока — один клик.
const props = defineProps<{
  items: { id: string; label: string; count?: number; hidden?: boolean }[]
  scrollRoot?: HTMLElement | null
}>()

const activeId = ref<string>('')
const visible = computed(() => props.items.filter((i) => !i.hidden))
let observer: IntersectionObserver | undefined

function observe() {
  observer?.disconnect()
  const root = props.scrollRoot ?? null
  observer = new IntersectionObserver((entries) => {
    const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
    if (hit?.target.id) activeId.value = hit.target.id
  }, { root, rootMargin: '-96px 0px -70% 0px', threshold: 0 })
  for (const item of visible.value) {
    const el = root?.querySelector(`#${item.id}`) ?? document.getElementById(item.id)
    if (el) observer.observe(el)
  }
}

onMounted(() => nextTick(observe))
watch(() => [props.items.map((i) => i.hidden).join(), props.scrollRoot], () => nextTick(observe))
onBeforeUnmount(() => observer?.disconnect())

function go(id: string) {
  const root = props.scrollRoot
  const el = root?.querySelector(`#${id}`) ?? document.getElementById(id)
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  activeId.value = id
}
</script>

<template>
  <nav class="scrollbar-none flex gap-1 overflow-x-auto">
    <button
      v-for="item in visible" :key="item.id" type="button"
      class="focus-ring flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-colors"
      :class="activeId === item.id ? 'bg-soft text-ink' : 'text-muted hover:text-ink'"
      @click="go(item.id)"
    >
      {{ item.label }}
      <span v-if="item.count" class="tabular rounded-full bg-line px-1.5 text-[10.5px]">{{ item.count }}</span>
    </button>
  </nav>
</template>
