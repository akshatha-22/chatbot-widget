const DEFAULT_API_URL = 'http://localhost:8000'

let apiBaseUrl = DEFAULT_API_URL

/** API origin without trailing slash (e.g. https://api.example.com). */
export function getApiBaseUrl(): string {
  return apiBaseUrl
}

export function setApiBaseUrl(url: string): void {
  const trimmed = (url || '').trim().replace(/\/$/, '')
  apiBaseUrl = trimmed || DEFAULT_API_URL
}

/** Initialize from Vite env — used by the dev app entry (`main.tsx`). */
export function initApiFromEnv(): void {
  const envUrl =
    typeof import.meta !== 'undefined'
      ? (import.meta as ImportMeta & { env?: { VITE_API_URL?: string } }).env
          ?.VITE_API_URL
      : undefined
  if (envUrl) {
    setApiBaseUrl(envUrl)
  }
}
