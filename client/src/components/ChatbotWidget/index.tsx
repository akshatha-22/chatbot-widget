import { useCallback, useEffect, useState } from 'react'
import CompactWidget from './CompactWidget'
import ExpandedWidget from './ExpandedWidget'
import {
  createConversation,
  deleteConversation,
  getConversationMessages,
  getConversations,
} from '../../api/chat'
import { listFiles } from '../../api/files'
import { loadStarredIds, toggleStarredId } from '../../utils/starredStorage'
import type { Conversation, Message, UploadedFile } from '../../types'

const ChatbotWidget = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(
    null,
  )
  const [messages, setMessages] = useState<Message[]>([])
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [starredIds, setStarredIds] = useState<Set<string>>(() => loadStarredIds())
  const [chatReady, setChatReady] = useState(false)

  const refreshConversations = useCallback(async () => {
    const list = await getConversations()
    setConversations(list)
    return list
  }, [])

  const loadConversationData = useCallback(async (conv: Conversation) => {
    setActiveConversation(conv)
    try {
      const msgs = await getConversationMessages(conv.id)
      setMessages(msgs)
    } catch {
      setMessages([])
    }
    const uploaded = await listFiles(conv.id).catch(() => [])
    setFiles(uploaded)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        const list = await getConversations()
        if (cancelled) return

        setConversations(list)
        if (list.length > 0) {
          await loadConversationData(list[0])
        } else {
          const created = await createConversation('New Chat')
          if (cancelled) return
          setConversations([created])
          setActiveConversation(created)
          setMessages([])
          setFiles([])
        }
      } finally {
        if (!cancelled) setChatReady(true)
      }
    }

    init()
    return () => {
      cancelled = true
    }
  }, [loadConversationData])

  const handleSelectConversation = useCallback(
    async (conv: Conversation) => {
      await loadConversationData(conv)
    },
    [loadConversationData],
  )

  const handleNewConversation = useCallback(async () => {
    const created = await createConversation('New Chat')
    setConversations((prev) => [created, ...prev])
    setActiveConversation(created)
    setMessages([])
    setFiles([])
  }, [])

  const handleDeleteConversation = useCallback(
    async (id: string) => {
      await deleteConversation(id)
      const remaining = conversations.filter((c) => c.id !== id)
      setConversations(remaining)

      if (activeConversation?.id !== id) return

      if (remaining.length > 0) {
        await loadConversationData(remaining[0])
      } else {
        setActiveConversation(null)
        setMessages([])
        setFiles([])
      }
    },
    [activeConversation?.id, conversations, loadConversationData],
  )

  const handleRenameConversation = useCallback((title: string) => {
    if (!activeConversation) return
    const updated = { ...activeConversation, title }
    setActiveConversation(updated)
    setConversations((prev) =>
      prev.map((c) => (c.id === updated.id ? { ...c, title } : c)),
    )
  }, [activeConversation])

  const handleToggleStar = useCallback((id: string) => {
    setStarredIds(toggleStarredId(id))
  }, [])

  const close = () => {
    setIsOpen(false)
    setIsExpanded(false)
  }

  const sharedProps = {
    conversation: activeConversation,
    messages,
    files,
    onMessagesChange: setMessages,
    onFilesChange: setFiles,
    onClose: close,
    starredIds,
    onToggleStar: handleToggleStar,
    onRefreshConversations: refreshConversations,
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-500 rounded-full shadow-lg flex items-center justify-center hover:bg-indigo-600 transition-colors z-50"
        aria-label="Open chat"
      >
        <span className="text-white text-xl">💬</span>
      </button>
    )
  }

  if (!chatReady) {
    return (
      <div className="fixed bottom-[88px] right-5 w-[350px] rounded-2xl border border-gray-200 bg-white shadow-xl p-6 z-50 text-sm text-gray-400">
        Loading chat…
      </div>
    )
  }

  if (isExpanded) {
    return (
      <ExpandedWidget
        {...sharedProps}
        conversations={conversations}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
        onDeleteConversation={handleDeleteConversation}
        onRenameConversation={handleRenameConversation}
        onCollapse={() => setIsExpanded(false)}
      />
    )
  }

  return (
    <CompactWidget
      {...sharedProps}
      onExpand={() => setIsExpanded(true)}
    />
  )
}

export default ChatbotWidget
