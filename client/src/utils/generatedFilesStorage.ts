export type StoredGeneratedFile = {
  id: string
  filename: string
  format: string
  type: string
  created_at: string
  content: string
}

function storageKey(conversationId: string) {
  return `chatbot-generated-files-${conversationId}`
}

export function loadGeneratedFiles(conversationId: string): StoredGeneratedFile[] {
  try {
    const raw = localStorage.getItem(storageKey(conversationId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as StoredGeneratedFile[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveGeneratedFiles(
  conversationId: string,
  files: StoredGeneratedFile[],
): void {
  localStorage.setItem(storageKey(conversationId), JSON.stringify(files))
}

export function appendGeneratedFile(
  conversationId: string,
  file: Omit<StoredGeneratedFile, 'id' | 'created_at'> & {
    id?: string
    created_at?: string
  },
): StoredGeneratedFile {
  const entry: StoredGeneratedFile = {
    id: file.id ?? crypto.randomUUID(),
    created_at: file.created_at ?? new Date().toISOString(),
    filename: file.filename,
    format: file.format,
    type: file.type,
    content: file.content,
  }
  const next = [entry, ...loadGeneratedFiles(conversationId)]
  saveGeneratedFiles(conversationId, next)
  return entry
}

export function removeGeneratedFile(conversationId: string, fileId: string): void {
  const next = loadGeneratedFiles(conversationId).filter((f) => f.id !== fileId)
  saveGeneratedFiles(conversationId, next)
}
