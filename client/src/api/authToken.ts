/** Shared JWT access for axios and fetch (must match login storage key). */
export function getAuthToken(): string | null {
  return localStorage.getItem('token')
}

export function authHeaders(
  extra: Record<string, string> = {},
): Record<string, string> {
  const token = getAuthToken()
  return {
    ...extra,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}
