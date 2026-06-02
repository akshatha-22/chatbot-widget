const ARCHIVED_KEY = 'chatbot-archived-conversations'
const TRASH_KEY = 'chatbot-trashed-conversations'

export type ConvCategory = 'All' | 'Starred' | 'Archived' | 'Trash'

function loadSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as string[]
    return new Set(Array.isArray(parsed) ? parsed.map(String) : [])
  } catch {
    return new Set()
  }
}

function saveSet(key: string, ids: Set<string>): void {
  localStorage.setItem(key, JSON.stringify([...ids]))
}

export function loadArchivedIds(): Set<string> {
  return loadSet(ARCHIVED_KEY)
}

export function loadTrashedIds(): Set<string> {
  return loadSet(TRASH_KEY)
}

export function saveArchivedIds(ids: Set<string>): void {
  saveSet(ARCHIVED_KEY, ids)
}

export function saveTrashedIds(ids: Set<string>): void {
  saveSet(TRASH_KEY, ids)
}

type ConversationLike = { id: string }

/** Inbox: not in trash. Archived/Trash/Starred use client-side folder sets (localStorage). */
export function filterByFolder<T extends ConversationLike>(
  conversations: T[],
  category: ConvCategory,
  starredIds: Set<string>,
  archivedIds: Set<string>,
  trashedIds: Set<string>,
): T[] {
  return conversations.filter((c: T) => {
    const id = String(c.id)
    const trashed = trashedIds.has(id)
    const archived = archivedIds.has(id)

    switch (category) {
      case 'Trash':
        return trashed
      case 'Archived':
        return archived && !trashed
      case 'Starred':
        return starredIds.has(id) && !trashed && !archived
      case 'All':
      default:
        return !trashed && !archived
    }
  })
}

export function archiveConversationId(id: string): Set<string> {
  const archived = loadArchivedIds()
  const trashed = loadTrashedIds()
  trashed.delete(id)
  archived.add(id)
  saveTrashedIds(trashed)
  saveArchivedIds(archived)
  return archived
}

export function unarchiveConversationId(id: string): Set<string> {
  const archived = loadArchivedIds()
  archived.delete(id)
  saveArchivedIds(archived)
  return archived
}

export function trashConversationId(id: string): Set<string> {
  const trashed = loadTrashedIds()
  const archived = loadArchivedIds()
  archived.delete(id)
  trashed.add(id)
  saveArchivedIds(archived)
  saveTrashedIds(trashed)
  return trashed
}

export function restoreConversationFromTrash(id: string): Set<string> {
  const trashed = loadTrashedIds()
  trashed.delete(id)
  saveTrashedIds(trashed)
  return trashed
}

export function removeConversationFromFolders(id: string): void {
  const archived = loadArchivedIds()
  const trashed = loadTrashedIds()
  archived.delete(id)
  trashed.delete(id)
  saveArchivedIds(archived)
  saveTrashedIds(trashed)
}
