const STORAGE_KEY = 'chatbot-starred-conversations'

export function loadStarredIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as string[]
    return new Set(Array.isArray(parsed) ? parsed.map(String) : [])
  } catch {
    return new Set()
  }
}

export function saveStarredIds(ids: Set<string>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]))
}

export function toggleStarredId(id: string): Set<string> {
  const next = loadStarredIds()
  if (next.has(id)) next.delete(id)
  else next.add(id)
  saveStarredIds(next)
  return next
}
