export default defineNuxtRouteMiddleware((to) => {
  const auth = useAuthStore()
  auth.restore()

  if (!auth.isAuthed && to.path !== '/login') {
    return navigateTo('/login')
  }
  if (auth.isAuthed && to.path === '/login') {
    return navigateTo('/')
  }
})
