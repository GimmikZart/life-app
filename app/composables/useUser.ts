export function useUser() {
  const user = useSupabaseUser()

  return {
    user,
    isAuthenticated: computed(() => Boolean(user.value))
  }
}
