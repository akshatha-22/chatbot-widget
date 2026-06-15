import type { MutableRefObject } from 'react'
import { streamMessage } from '../../api/chat'
import { RateLimitError } from '../../api/rateLimit'
import { generatePDFFromContent } from '../../utils/pdfGenerator'
import type { Conversation, Message } from '../../types'

export type StreamSendParams = {
  conversation: Conversation
  content: string
  isTyping: boolean
  isSendingRef: MutableRefObject<boolean>
  streamControllerRef?: MutableRefObject<AbortController | null>
  onMessagesChange: React.Dispatch<React.SetStateAction<Message[]>>
  onRefreshConversations: () => Promise<unknown>
  setIsTyping: (value: boolean) => void
  onRateLimit?: (retryAfterSeconds: number) => void
}

/** Stream a user message once (guards against double-submit / StrictMode races). */
export async function streamSendMessage({
  conversation,
  content,
  isTyping,
  isSendingRef,
  streamControllerRef,
  onMessagesChange,
  onRefreshConversations,
  setIsTyping,
  onRateLimit,
}: StreamSendParams): Promise<void> {
  if (!content || isTyping || isSendingRef.current) return
  isSendingRef.current = true

  const conversationId = conversation.id
  const userMsg: Message = {
    id: Date.now().toString(),
    role: 'user',
    content,
    created_at: new Date().toISOString(),
  }
  const assistantId = `stream-${Date.now()}`

  const controller = new AbortController()
  if (streamControllerRef) {
    if (streamControllerRef.current) {
      streamControllerRef.current.abort()
    }
    streamControllerRef.current = controller
  }

  onMessagesChange((prev) => [...prev, userMsg])
  setIsTyping(true)

  try {
    await streamMessage(conversationId, content, {
      onChunk: (chunk) => {
        if (controller.signal.aborted) return
        setIsTyping(false)
        onMessagesChange((prev) => {
          const existing = prev.find((m) => m.id === assistantId)
          if (!existing) {
            return [
              ...prev,
              {
                id: assistantId,
                role: 'assistant',
                content: chunk,
                created_at: new Date().toISOString(),
                source: 'catalog',
                links: [],
              },
            ]
          }
          return prev.map((m) =>
            m.id === assistantId ? { ...m, content: m.content + chunk } : m,
          )
        })
      },
      onDone: (msg) => {
        if (controller.signal.aborted) return
        setIsTyping(false)
        onMessagesChange((prev) => {
          const existing = prev.find((m) => m.id === assistantId)
          if (existing) {
            return prev.map((m) => (m.id === assistantId ? msg : m))
          }
          return [...prev, msg]
        })
        if (msg.has_pdf && msg.pdf_content) {
          void generatePDFFromContent(
            msg.pdf_content,
            msg.pdf_filename || 'remi-generated.pdf',
          )
        }
        void onRefreshConversations()
      },
    }, controller.signal)
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return
    }
    if (err instanceof RateLimitError) {
      onRateLimit?.(err.retryAfterSeconds)
    }
    if (!controller.signal.aborted) {
      onMessagesChange((prev) => prev.filter((m) => m.id !== assistantId))
    }
  } finally {
    if (streamControllerRef?.current === controller) {
      streamControllerRef.current = null
    }
    if (!controller.signal.aborted) {
      setIsTyping(false)
    }
    isSendingRef.current = false
  }
}
