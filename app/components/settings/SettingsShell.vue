<script setup lang="ts">
import { SETTINGS_NAV } from '~/data/settingsNav'

defineProps<{ title: string; subtitle?: string }>()
const route = useRoute()
const groups = computed(() => [...new Set(SETTINGS_NAV.map((i) => i.group))])
</script>

<template>
  <div class="grid grid-cols-1 gap-5 lg:grid-cols-[220px_1fr]">
    <aside class="lg:sticky lg:top-[84px] lg:self-start">
      <NuxtLink to="/settings" class="mb-3 flex items-center gap-1.5 text-[12.5px] font-semibold text-muted hover:text-ink">
        <Icon name="ph:arrow-left" size="14" /> Все настройки
      </NuxtLink>
      <nav class="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
        <div v-for="g in groups" :key="g" class="lg:mb-3">
          <p class="mb-1 hidden px-2.5 text-[10.5px] font-bold uppercase tracking-wide text-muted lg:block">{{ g }}</p>
          <div class="flex gap-1 lg:flex-col">
            <NuxtLink
              v-for="item in SETTINGS_NAV.filter((i) => i.group === g)" :key="item.slug" :to="`/settings/${item.slug}`"
              class="focus-ring flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl2 px-2.5 py-2 text-[13px] font-medium transition-colors"
              :class="route.path === `/settings/${item.slug}` ? 'bg-plum-soft text-plum' : 'text-ink hover:bg-soft'"
            >
              <Icon :name="item.icon" size="16" /> {{ item.label }}
            </NuxtLink>
          </div>
        </div>
      </nav>
    </aside>

    <div class="min-w-0">
      <div class="mb-4">
        <h1 class="text-[21px] font-semibold tracking-[-0.02em]">{{ title }}</h1>
        <p v-if="subtitle" class="mt-1 text-[13px] text-muted">{{ subtitle }}</p>
      </div>
      <slot />
    </div>
  </div>
</template>
