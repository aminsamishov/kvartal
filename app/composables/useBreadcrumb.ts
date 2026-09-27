export interface BreadcrumbItem {
  label: string
  to?: string
}

// definePageMeta({ breadcrumb: [...] }) покрывает статичные заголовки;
// для страниц вида /objects/[id] хлебная крошка зависит от загруженных данных —
// этот composable обновляет route.meta реактивно, когда данные появляются.
export function useBreadcrumb(items: () => BreadcrumbItem[]) {
  const route = useRoute()
  watchEffect(() => {
    route.meta.breadcrumb = items()
  })
}
