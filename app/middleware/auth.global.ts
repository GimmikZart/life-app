const publicRoutes = new Set(['/login', '/signup', '/logout'])

export default defineNuxtRouteMiddleware((to) => {
  const { isAuthenticated } = useUser()

  if (!isAuthenticated.value && !publicRoutes.has(to.path)) {
    return navigateTo('/login')
  }

  if (isAuthenticated.value && (to.path === '/login' || to.path === '/signup')) {
    return navigateTo('/')
  }
})
