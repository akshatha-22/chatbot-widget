import type { MutableRefObject } from 'react'
import { streamMessage } from '../../api/chat'
import { generatePDFFromContent } from '../../utils/pdfGenerator'
import type { Conversation, Message } from '../../types'

export type StreamSendParams = {
  conversation: Conversation
  content: string
  isTyping: boolean
  isSendingRef: MutableRefObject<boolean>
  onMessagesChange: React.Dispatch<React.SetStateAction<Message[]>>
  onRefreshConversations: () => Promise<unknown>
  setIsTyping: (value: boolean) => void
}

/** Stream a user message once (guards against double-submit / StrictMode races). */
export async function streamSendMessage({
  conversation,
  content,
  isTyping,
  isSendingRef,
  onMessagesChange,
  onRefreshConversations,
  setIsTyping,
}: StreamSendParams): Promise<void> {
  if (!content || isTyping || isSendingRef.current) return
  isSendingRef.current = true

  const userMsg: Message = {
    id: Date.now().toString(),
    role: 'user',
    content,
    created_at: new Date().toISOString(),
  }
  const assistantId = `stream-${Date.now()}`

  onMessagesChange((prev) => [...prev, userMsg])
  setIsTyping(true)

  try {
    await streamMessage(conversation.id, content, {
      onChunk: (chunk) => {
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
              },
            ]
          }
          return prev.map((m) =>
            m.id === assistantId ? { ...m, content: m.content + chunk } : m,
          )
        })
      },
      onDone: (msg) => {
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
    })
  } catch {
    onMessagesChange((prev) => prev.filter((m) => m.id !== assistantId))
  } finally {
    setIsTyping(false)
    isSendingRef.current = false
  }
}
