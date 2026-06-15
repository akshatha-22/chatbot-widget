import apiClient from './client'
import { readRateLimitFromResponse } from './rateLimit'

export interface Conversation {
  id: string
  title: string
  created_at: string
  updated_at?: string
}

export interface Message {
  id: string
  conversation_id?: string
  content: string
  role: 'user' | 'assistant'
  created_at: string
  has_pdf?: boolean
  pdf_content?: string | null
  pdf_filename?: string | null
  cache_hit?: boolean
  source?: 'catalog' | 'web' | 'none'
  links?: { url: string; title: string }[]
}

// baseURL is already http://localhost:8000/api/v1
// so these resolve to /api/v1/chat/conversations etc.

export async function getConversations(): Promise<Conversation[]> {
  try {
    const response = await apiClient.get('/chat/conversations')
    const list = response.data || []
    return list.map((c: Conversation) => ({ ...c, id: String(c.id) }))
  } catch (error) {
    console.error('Error fetching conversations:', error)
    return []
  }
}

export async function getConversationMessages(
  conversationId: string,
): Promise<Message[]> {
  const response = await apiClient.get(
    `/chat/conversations/${conversationId}/messages`,
  )
  return (response.data ?? []).map((m: Message) => ({
    ...m,
    id: String(m.id),
    role: m.role as Message['role'],
    has_pdf: m.has_pdf ?? false,
    pdf_content: m.pdf_content ?? null,
    pdf_filename: m.pdf_filename ?? null,
    source: m.source ?? 'catalog',
    links: m.links ?? [],
  }))
}

export async function createConversation(title: string): Promise<Conversation> {
  const response = await apiClient.post('/chat/conversations', { title })
  const data = response.data
  return { ...data, id: String(data.id) }
}

const API_BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000').replace(
  /\/$/,
  '',
)

export type StreamMessageHandlers = {
  onChunk: (text: string) => void
  onDone?: (message: Message) => void
  onError?: (error: Error) => void
}

function parseSsePayload(raw: string): { type: 'chunk'; text: string } | { type: 'done'; message: Message } | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  try {
    const parsed = JSON.parse(trimmed) as {
      event?: string
      id?: number | string
      role?: string
      content?: string
      created_at?: string
      has_pdf?: boolean
      pdf_content?: string | null
      pdf_filename?: string | null
      cache_hit?: boolean
      source?: 'catalog' | 'web' | 'none'
      links?: { url: string; title: string }[]
    }
    if (parsed.event === 'done' && parsed.content != null) {
      return {
        type: 'done',
        message: {
          id: String(parsed.id),
          role: 'assistant',
          content: parsed.content,
          created_at: parsed.created_at ?? new Date().toISOString(),
          has_pdf: parsed.has_pdf ?? false,
          pdf_content: parsed.pdf_content ?? null,
          pdf_filename: parsed.pdf_filename ?? null,
          cache_hit: parsed.cache_hit ?? false,
          source: parsed.source ?? 'catalog',
          links: parsed.links ?? [],
        },
      }
    }
  } catch {
    /* plain text chunk */
  }

  return { type: 'chunk', text: trimmed }
}

/** Stream assistant reply via POST .../messages/stream (SSE). */
export async function streamMessage(
  conversationId: string,
  content: string,
  handlers: StreamMessageHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const token = localStorage.getItem('token')
  const url = `${API_BASE}/api/v1/chat/conversations/${conversationId}/messages/stream`

  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ content }),
      signal,
    })
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return
    }
    const error = err instanceof Error ? err : new Error('Network error')
    handlers.onError?.(error)
    throw error
  }

  if (!response.ok) {
    if (response.status === 429) {
      const rateLimitError = await readRateLimitFromResponse(response)
      handlers.onError?.(rateLimitError)
      throw rateLimitError
    }
    const error = new Error(`Stream failed (${response.status})`)
    handlers.onError?.(error)
    throw error
  }

  if (!response.body) {
    const error = new Error('Streaming not supported')
    handlers.onError?.(error)
    throw error
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  const processEventBlock = (block: string) => {
    const dataLines = block
      .split('\n')
      .filter((line) => line.startsWith('data: '))
      .map((line) => line.slice(6))
    if (!dataLines.length) return

    const payload = dataLines.join('\n')
    const parsed = parseSsePayload(payload)
    if (!parsed) return
    if (parsed.type === 'done') {
      handlers.onDone?.(parsed.message)
    } else {
      handlers.onChunk(parsed.text)
    }
  }

  try {
    while (true) {
      if (signal?.aborted) break
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      let boundary = buffer.indexOf('\n\n')
      while (boundary !== -1) {
        const block = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)
        processEventBlock(block)
        boundary = buffer.indexOf('\n\n')
      }
    }

    if (buffer.trim()) {
      processEventBlock(buffer)
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return
    }
    const error = err instanceof Error ? err : new Error('Stream read failed')
    handlers.onError?.(error)
    throw error
  }
}

export async function sendMessage(
  conversationId: string,
  content: string
): Promise<Message> {
  const response = await apiClient.post<Message | Message[]>(
    `/chat/conversations/${conversationId}/messages`,
    { content }
  )
  const data = response.data
  // Backend returns [userMessage, assistantMessage]; widgets already show the user message optimistically
  const list = Array.isArray(data) ? data : [data]
  const assistant =
    list.find((m) => m.role === 'assistant') ?? list[list.length - 1]
  return {
    ...assistant,
    id: String(assistant.id),
    role: assistant.role as 'user' | 'assistant',
    has_pdf: assistant.has_pdf ?? false,
    pdf_content: assistant.pdf_content ?? null,
    pdf_filename: assistant.pdf_filename ?? null,
    source: assistant.source ?? 'catalog',
    links: assistant.links ?? [],
  }
}

export async function deleteConversation(id: string): Promise<void> {
  await apiClient.delete(`/chat/conversations/${id}`)
}

export async function renameConversation(
  id: string,
  title: string,
): Promise<Conversation> {
  const response = await apiClient.patch(`/chat/conversations/${id}`, { title })
  const data = response.data
  return { ...data, id: String(data.id) }
}

export type GenerateConversationFileRequest = {
  type: 'summary' | 'report' | 'analysis'
  format: 'pdf' | 'docx' | 'txt'
}

export type GenerateConversationFileResponse = {
  filename: string
  format: 'pdf' | 'docx' | 'txt'
  content: string
  type: string
}

export async function generateConversationFile(
  conversationId: string,
  payload: GenerateConversationFileRequest,
): Promise<GenerateConversationFileResponse> {
  const response = await apiClient.post(
    `/chat/conversations/${conversationId}/generate`,
    payload,
  )
  return response.data
}

export type ConversationDetail = Conversation & {
  user_id?: number
  messages: Message[]
}

export async function getConversationDetail(
  conversationId: string,
): Promise<ConversationDetail> {
  const response = await apiClient.get(`/chat/conversations/${conversationId}`)
  const data = response.data
  return {
    ...data,
    id: String(data.id),
    messages: (data.messages ?? []).map((m: Message) => ({
      ...m,
      id: String(m.id),
      role: m.role as Message['role'],
      has_pdf: m.has_pdf ?? false,
      pdf_content: m.pdf_content ?? null,
      pdf_filename: m.pdf_filename ?? null,
      source: m.source ?? 'catalog',
      links: m.links ?? [],
    })),
  }
}
