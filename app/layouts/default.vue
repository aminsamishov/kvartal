<script setup lang="ts">
const route = useRoute()
const ui = useUiStore()
const unitsStore = useUnitsStore()
const salesStore = useSalesStore()
const dealsStore = useDealsStore()
const pricingStore = usePricingStore()
const settingsStore = useSettingsStore()
const miscStore = useMiscStore()
const approvalsStore = useApprovalsStore()

/**
 * Данные грузим без блокировки каркаса: раньше `await` в setup держал весь
 * экран пустым до последнего ответа. Теперь сразу видны меню и шапка, а на
 * месте содержимого — заглушка формой будущей страницы.
 */
const ready = computed(() => unitsStore.loaded && salesStore.loaded && dealsStore.loaded
  && pricingStore.loaded && settingsStore.loaded && miscStore.loaded && approvalsStore.loaded)

const BOARD_ROUTES = ['/board', '/deals/new']
const LIST_ROUTES = ['/leads', '/contracts', '/payments', '/clients', '/documents', '/users', '/offices', '/approvals', '/pricing']
const skeletonKind = computed(() => {
  if (BOARD_ROUTES.some((r) => route.path.startsWith(r))) return 'board' as const
  if (LIST_ROUTES.some((r) => route.path.startsWith(r))) return 'list' as const
  return 'dashboard' as const
})

onMounted(async () => {
  await Promise.all([
    unitsStore.load(), salesStore.load(), dealsStore.load(),
    pricingStore.load(), settingsStore.load(), miscStore.load(), approvalsStore.load(),
  ])
  // Автоматизации гоняем после загрузки данных: истёкшие брони, напоминания
  // после показа и просрочки по графику не должны ждать, пока менеджер
  // откроет нужный раздел.
  runAutomations()
  restorePickerFilters()
})
</script>

<template>
  <div class="min-h-screen bg-bg">
    <AppSidebar />
    <div class="flex min-h-screen flex-col transition-[padding] duration-150" :class="ui.sidebarCollapsed ? 'lg:pl-[76px]' : 'lg:pl-[248px]'">
      <AppTopbar />
      <main class="flex-1 px-4 py-5 lg:px-7 lg:py-6">
        <!--
          Без mode="out-in": он ждёт конца ухода скелетона, а переходы Vue
          продвигаются через requestAnimationFrame. В фоновой вкладке rAF
          заморожен, уход не завершается — и страница залипала на скелетоне,
          пока вкладку не откроют. Теперь содержимое появляется сразу.
        -->
        <Transition
          enter-active-class="transition-opacity duration-200" leave-active-class="transition-opacity duration-100"
          enter-from-class="opacity-0" leave-to-class="opacity-0"
        >
          <PageSkeleton v-if="!ready" :key="`sk-${skeletonKind}`" :kind="skeletonKind" />
          <slot v-else />
        </Transition>
      </main>
    </div>
    <ToastHost />
  </div>
</template>
