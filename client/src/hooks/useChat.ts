import { useState, useCallback } from 'react'

interface Message {
  id: string
  content: string
  author: 'user' | 'assistant'
  timestamp: Date
  status: 'sending' | 'sent' | 'error'
}

/**
 * useChat Hook
 * Manages chat message state and operations
 */
export const useChat = () => {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addMessage = useCallback((
    content: string,
    author: 'user' | 'assistant' = 'user'
  ) => {
    const message: Message = {
      id: `msg-${Date.now()}`,
      content,
      author,
      timestamp: new Date(),
      status: 'sending',
    }
    setMessages((prev) => [...prev, message])
    return message
  }, [])

  const updateMessage = useCallback((
    id: string,
    updates: Partial<Message>
  ) => {
    setMessages((prev) =>
      prev.map((msg) => (msg.id === id ? { ...msg, ...updates } : msg))
    )
  }, [])

  const clearMessages = useCallback(() => {
    setMessages([])
  }, [])

  const sendMessage = useCallback(async (content: string) => {
    try {
      setIsLoading(true)
      setError(null)

      // Add user message
      const userMessage = addMessage(content, 'user')
      updateMessage(userMessage.id, { status: 'sent' })

      // Here you would call the API to get the response
      // For now, this is a placeholder
      addMessage('Response from assistant', 'assistant')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      const lastMessage = messages[messages.length - 1]
      if (lastMessage) {
        updateMessage(lastMessage.id, { status: 'error' })
      }
    } finally {
      setIsLoading(false)
    }
  }, [messages, addMessage, updateMessage])

  return {
    messages,
    isLoading,
    error,
    addMessage,
    updateMessage,
    clearMessages,
    sendMessage,
  }
}
