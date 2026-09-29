<script setup lang="ts">
import { NAV, type NavAccent } from '~/data/nav'

const ui = useUiStore()
const route = useRoute()
const { can } = useAccess()

/**
 * Меню показывает только то, что роли доступно: пункт, который при нажатии
 * отправляет обратно на дашборд, хуже, чем его отсутствие.
 */
const groups = computed(() => NAV
  .map((g) => ({ ...g, items: g.items.filter((i) => !i.can || can(i.can)) }))
  .filter((g) => g.items.length))

function isActive(to: string) {
  if (to === '/') return route.path === '/'
  return route.path === to || route.path.startsWith(`${to}/`)
}

/**
 * Цвет модуля живёт на иконке, а не на подписи: цветной текст в меню читается
 * хуже белого, а цветная иконка работает ориентиром — по ней раздел находят
 * боковым зрением. У активного пункта тем же цветом светится метка слева.
 */
const ACCENT: Record<NavAccent, string> = {
  objects: 'var(--mod-objects)',
  price: 'var(--mod-price)',
  sales: 'var(--mod-sales)',
  reserve: 'var(--mod-reserve)',
  finance: 'var(--mod-finance)',
  docs: 'var(--mod-docs)',
  analytics: 'var(--mod-analytics)',
  users: 'var(--mod-users)',
  system: 'var(--mod-system)',
}
</script>

<template>
  <aside
    class="side-scroll fixed inset-y-0 left-0 z-40 flex flex-col overflow-y-auto border-r border-side-line bg-side text-side-ink transition-[width] duration-150"
    :class="[ui.sidebarCollapsed ? 'w-[76px]' : 'w-[248px]', ui.mobileNavOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0']"
  >
    <div class="flex h-16 shrink-0 items-center gap-2.5 px-4">
      <div class="grid h-9 w-9 shrink-0 place-items-center rounded-xl2 bg-fill-plum font-disp text-[15px] font-bold text-white">IH</div>
      <span v-if="!ui.sidebarCollapsed" class="font-disp text-[16px] font-semibold text-white">InHouse</span>
    </div>

    <nav class="flex-1 space-y-4 px-2.5 pb-4">
      <div v-for="(group, gi) in groups" :key="gi">
        <p v-if="group.label && !ui.sidebarCollapsed" class="mb-1 mt-2 px-2.5 text-[10.5px] font-bold uppercase tracking-wider text-side-ink/50">
          {{ group.label }}
        </p>
        <div class="space-y-0.5">
          <NuxtLink
            v-for="item in group.items" :key="item.to" :to="item.to"
            class="focus-ring group relative flex items-center gap-2.5 rounded-xl2 px-2.5 py-2 text-[13.5px] font-medium transition-colors"
            :class="isActive(item.to) ? 'bg-side-panel text-white' : 'text-side-ink hover:bg-side-panel/60 hover:text-white'"
            :title="ui.sidebarCollapsed ? item.label : undefined"
          >
            <span
              v-if="isActive(item.to)" class="absolute -left-2.5 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full"
              :style="{ background: ACCENT[item.accent] }"
            />
            <span
              class="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-lg transition-colors"
              :style="isActive(item.to)
                ? { background: `color-mix(in srgb, ${ACCENT[item.accent]} 22%, transparent)`, color: ACCENT[item.accent] }
                : { color: ACCENT[item.accent] }"
            >
              <Icon :name="item.icon" size="17" />
            </span>
            <span v-if="!ui.sidebarCollapsed" class="truncate">{{ item.label }}</span>
          </NuxtLink>
        </div>
      </div>
    </nav>

    <button
      type="button"
      class="focus-ring m-2.5 flex items-center justify-center gap-2 rounded-xl2 border border-side-line py-2 text-[12.5px] font-semibold text-side-ink hover:bg-side-panel hover:text-white"
      @click="ui.toggleSidebar"
    >
      <Icon :name="ui.sidebarCollapsed ? 'ph:caret-line-right' : 'ph:caret-line-left'" size="15" />
      <span v-if="!ui.sidebarCollapsed">Свернуть меню</span>
    </button>
  </aside>
  <div v-if="ui.mobileNavOpen" class="fixed inset-0 z-30 bg-ink/40 lg:hidden" @click="ui.mobileNavOpen = false" />
</template>
