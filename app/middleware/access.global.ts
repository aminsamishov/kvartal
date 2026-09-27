import { capsOf, routeCapability } from '~/utils/access'

/**
 * Закрытый раздел не должен открываться по прямой ссылке — иначе право
 * существует только в меню. Проверяем маршрут тем же правом, каким скрыт
 * пункт навигации.
 */
export default defineNuxtRouteMiddleware((to) => {
  const auth = useAuthStore()
  auth.restore()
  if (!auth.isAuthed) return

  const cap = routeCapability(to.path)
  if (!cap) return
  if (capsOf(auth.user?.role).has(cap)) return

  if (import.meta.client) useUiStore().toast('Раздел недоступен для вашей роли', 'warn')
  return navigateTo('/')
})
