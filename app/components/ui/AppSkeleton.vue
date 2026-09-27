<script setup lang="ts">
/**
 * Заглушка на время загрузки. Формой повторяет то, что появится на её месте:
 * пустой экран с крутилкой не даёт понять, сколько ждать и что будет дальше,
 * а прыгающая раскладка после загрузки читается как сбой.
 *
 * Анимация одна на все заглушки: бегущий блик, а не пульсация прозрачности —
 * десяток пульсирующих блоков рядом выглядит как ошибка рендера.
 */
withDefaults(defineProps<{
  /** высота блока: строка, заголовок, карточка или произвольная */
  variant?: 'text' | 'title' | 'block' | 'circle'
  width?: string
  height?: string
  rounded?: string
}>(), { variant: 'text' })

const HEIGHTS: Record<string, string> = {
  text: '12px',
  title: '20px',
  block: '100%',
  circle: '36px',
}
</script>

<template>
  <span
    class="skeleton block shrink-0"
    :class="[rounded ?? (variant === 'circle' ? 'rounded-full' : 'rounded-md')]"
    :style="{
      width: width ?? (variant === 'circle' ? '36px' : '100%'),
      height: height ?? HEIGHTS[variant],
    }"
  />
</template>

<style scoped>
.skeleton {
  position: relative;
  overflow: hidden;
  background: var(--soft);
}
.skeleton::after {
  content: "";
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--line) 65%, transparent), transparent);
  animation: skeleton-sweep 1.25s ease-in-out infinite;
}
@keyframes skeleton-sweep {
  100% { transform: translateX(100%); }
}
@media (prefers-reduced-motion: reduce) {
  .skeleton::after { animation: none; }
}
</style>
