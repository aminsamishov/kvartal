<script setup lang="ts">
import { SETTINGS_NAV } from '~/data/settingsNav'

definePageMeta({ breadcrumb: [{ label: 'Настройки' }] })
const groups = computed(() => [...new Set(SETTINGS_NAV.map((i) => i.group))])
</script>

<template>
  <div class="flex flex-col gap-7">
    <div>
      <h1 class="text-[22px] font-semibold tracking-[-0.025em]">Настройки</h1>
      <p class="mt-1 text-[13px] text-muted">Всё, что определяет поведение платформы — по разделам, а не одним длинным списком</p>
    </div>

    <div v-for="g in groups" :key="g">
      <h2 class="mb-3 text-[12.5px] font-bold uppercase tracking-wide text-muted">{{ g }}</h2>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <NuxtLink
          v-for="item in SETTINGS_NAV.filter((i) => i.group === g)" :key="item.slug" :to="`/settings/${item.slug}`"
          class="group flex items-center gap-3 rounded-card border border-line bg-panel p-4 transition-shadow hover:shadow-panel"
        >
          <div class="grid h-10 w-10 shrink-0 place-items-center rounded-xl2 bg-plum-soft text-plum"><Icon :name="item.icon" size="18" /></div>
          <span class="text-[13.5px] font-semibold group-hover:text-plum">{{ item.label }}</span>
          <Icon name="ph:caret-right" size="15" class="ml-auto text-muted" />
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
