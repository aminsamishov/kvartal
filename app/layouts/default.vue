<script setup lang="ts">
const ui = useUiStore()
const unitsStore = useUnitsStore()
const salesStore = useSalesStore()
const dealsStore = useDealsStore()
const pricingStore = usePricingStore()
const settingsStore = useSettingsStore()
const miscStore = useMiscStore()
const approvalsStore = useApprovalsStore()

await Promise.all([
  unitsStore.load(), salesStore.load(), dealsStore.load(),
  pricingStore.load(), settingsStore.load(), miscStore.load(), approvalsStore.load(),
])

// Автоматизации гоняем после загрузки данных: истёкшие брони, напоминания
// после показа и просрочки по графику не должны ждать, пока менеджер
// откроет нужный раздел.
runAutomations()
</script>

<template>
  <div class="min-h-screen bg-bg">
    <AppSidebar />
    <div class="flex min-h-screen flex-col transition-[padding] duration-150" :class="ui.sidebarCollapsed ? 'lg:pl-[76px]' : 'lg:pl-[248px]'">
      <AppTopbar />
      <main class="flex-1 px-4 py-5 lg:px-7 lg:py-6">
        <slot />
      </main>
    </div>
    <ToastHost />
  </div>
</template>
