import { useCallback, useEffect, useRef, useState } from 'react'
import CompactWidget from './CompactWidget'
import ExpandedWidget from './ExpandedWidget'
import RemiLauncher from './RemiLauncher'
import WidgetAuthPanel from './WidgetAuthPanel'
import { WidgetThemeProvider } from './WidgetThemeContext'
import { setApiBaseUrl } from '../../api/config'
import {
  createConversation,
  deleteConversation,
  getConversationMessages,
  getConversations,
  renameConversation,
} from '../../api/chat'
import { getMe, logout as apiLogout } from '../../api/auth'
import { listFiles } from '../../api/files'
import { loadStarredIds, toggleStarredId } from '../../utils/starredStorage'
import {
  loadArchivedIds,
  loadTrashedIds,
  archiveConversationId,
  unarchiveConversationId,
  trashConversationId,
  restoreConversationFromTrash,
  removeConversationFromFolders,
} from '../../utils/conversationFoldersStorage'
import type { Conversation, Message, UploadedFile, User } from '../../types'
import { FILE_IN_PROGRESS_STATUSES } from '../../types'
import type { WidgetPosition } from '../../utils/widgetPosition'
import { desktopPanelClasses } from '../../utils/widgetPosition'

export type ChatbotWidgetProps = {
  /** Backend origin, e.g. https://api.example.com — required for script-tag embeds. */
  apiUrl?: string
  primaryColor?: string
  position?: WidgetPosition
}

function LoadingPanel({
  message,
  position,
}: {
  message: string
  position: WidgetPosition
}) {
  return (
    <div
      className={`fixed w-[350px] rounded-2xl border border-[#F0F0F0] bg-white shadow-[0_12px_40px_rgba(0,0,0,0.12)] p-6 z-50 text-sm text-[#8C8C8C] animate-widgetIn ${desktopPanelClasses(position)}`}
    >
      {message}
    </div>
  )
}

export function ChatbotWidget({
  apiUrl,
  primaryColor = '#2979FF',
  position = 'bottom-right',
}: ChatbotWidgetProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(
    null,
  )
  const [messages, setMessages] = useState<Message[]>([])
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [starredIds, setStarredIds] = useState<Set<string>>(() => loadStarredIds())
  const [archivedIds, setArchivedIds] = useState<Set<string>>(() => loadArchivedIds())
  const [trashedIds, setTrashedIds] = useState<Set<string>>(() => loadTrashedIds())
  const [chatReady, setChatReady] = useState(false)
  const [hasUnread, setHasUnread] = useState(false)
  const seenAssistantCount = useRef(0)
  const streamControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (apiUrl) {
      setApiBaseUrl(apiUrl)
    }
  }, [apiUrl])

  useEffect(() => {
    const root = document.querySelector('.remi-widget-root') as HTMLElement | null
    if (root) {
      root.style.setProperty('--remi-accent', primaryColor)
    }
  }, [primaryColor])

  const abortActiveStream = useCallback(() => {
    if (streamControllerRef.current) {
      streamControllerRef.current.abort()
      streamControllerRef.current = null
    }
  }, [])

  // Verify any existing token once on mount — the widget owns its own auth.
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      setAuthChecked(true)
      return
    }
    getMe()
      .then((me: User) => setUser(me))
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setAuthChecked(true))
  }, [])

  useEffect(() => {
    const assistantCount = messages.filter((m) => m.role === 'assistant').length
    if (isOpen) {
      seenAssistantCount.current = assistantCount
      return
    }
    if (assistantCount > seenAssistantCount.current) {
      setHasUnread(true)
    }
  }, [messages, isOpen])

  const openWidget = useCallback(() => {
    setIsOpen(true)
    setHasUnread(false)
    seenAssistantCount.current = messages.filter(
      (m) => m.role === 'assistant',
    ).length
  }, [messages])

  const refreshConversations = useCallback(async () => {
    const list = await getConversations()
    setConversations(list)
    return list
  }, [])

  const loadConversationData = useCallback(async (conv: Conversation) => {
    abortActiveStream()
    setActiveConversation(conv)
    try {
      const msgs = await getConversationMessages(conv.id)
      setMessages(msgs)
    } catch {
      setMessages([])
    }
    const uploaded = await listFiles(conv.id).catch(() => [])
    setFiles(uploaded)
  }, [abortActiveStream])

  useEffect(() => {
    if (!user) {
      setChatReady(false)
      return
    }

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
      } catch (err) {
        console.error('Failed to initialize chat:', err)
      } finally {
        if (!cancelled) setChatReady(true)
      }
    }

    setChatReady(false)
    void init()

    return () => {
      cancelled = true
    }
  }, [user, loadConversationData])

  // Poll while any file is still indexing (background embedding on server).
  useEffect(() => {
    if (!activeConversation || !user) return
    const hasPending = files.some((f) =>
      FILE_IN_PROGRESS_STATUSES.includes(f.status),
    )
    if (!hasPending) return

    const conversationId = activeConversation.id
    const interval = setInterval(async () => {
      try {
        const updated = await listFiles(conversationId)
        setFiles(updated)
        const stillPending = updated.some((f) =>
          FILE_IN_PROGRESS_STATUSES.includes(f.status),
        )
        if (!stillPending) {
          clearInterval(interval)
        }
      } catch (e) {
        console.error('File polling error:', e)
        clearInterval(interval)
      }
    }, 1500)

    const timeout = setTimeout(() => {
      clearInterval(interval)
    }, 5 * 60 * 1000)

    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [files, activeConversation, user])

  useEffect(() => {
    return () => {
      abortActiveStream()
    }
  }, [abortActiveStream])

  const handleSelectConversation = useCallback(
    async (conv: Conversation) => {
      await loadConversationData(conv)
    },
    [loadConversationData],
  )

  const handleNewConversation = useCallback(async () => {
    abortActiveStream()
    const created = await createConversation('New Chat')
    setConversations((prev) => [created, ...prev])
    setActiveConversation(created)
    setMessages([])
    setFiles([])
  }, [abortActiveStream])

  const handleDeleteConversation = useCallback(
    async (id: string) => {
      await deleteConversation(id)
      removeConversationFromFolders(id)
      setArchivedIds(loadArchivedIds())
      setTrashedIds(loadTrashedIds())
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

  const handleRenameConversation = useCallback(async (title: string) => {
    if (!activeConversation) return
    const id = activeConversation.id
    // Optimistic update so UI and sidebar stay in sync before any refresh.
    setActiveConversation((prev) => (prev ? { ...prev, title } : null))
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title } : c)),
    )
    try {
      await renameConversation(id, title)
    } catch (err) {
      console.error('Failed to rename conversation:', err)
    }
  }, [activeConversation])

  const handleToggleStar = useCallback((id: string) => {
    setStarredIds(toggleStarredId(id))
  }, [])

  const handleArchiveConversation = useCallback((id: string) => {
    setArchivedIds(archiveConversationId(id))
    setTrashedIds(loadTrashedIds())
  }, [])

  const handleUnarchiveConversation = useCallback((id: string) => {
    setArchivedIds(unarchiveConversationId(id))
  }, [])

  const handleTrashConversation = useCallback((id: string) => {
    setTrashedIds(trashConversationId(id))
    setArchivedIds(loadArchivedIds())
    if (activeConversation?.id === id) {
      const remaining = conversations.filter((c) => c.id !== id)
      if (remaining.length > 0) {
        void loadConversationData(remaining[0])
      } else {
        setActiveConversation(null)
        setMessages([])
        setFiles([])
      }
    }
  }, [activeConversation?.id, conversations, loadConversationData])

  const handleRestoreConversation = useCallback((id: string) => {
    setTrashedIds(restoreConversationFromTrash(id))
  }, [])

  const close = () => {
    setIsOpen(false)
    setIsExpanded(false)
  }

  const handleLogout = useCallback(() => {
    abortActiveStream()
    apiLogout()
    setUser(null)
    setChatReady(false)
    setConversations([])
    setActiveConversation(null)
    setMessages([])
    setFiles([])
    setIsExpanded(false)
    seenAssistantCount.current = 0
  }, [abortActiveStream])

  const sharedProps = {
    conversation: activeConversation,
    messages,
    files,
    onMessagesChange: setMessages,
    onFilesChange: setFiles,
    onClose: close,
    onLogout: handleLogout,
    starredIds,
    archivedIds,
    trashedIds,
    onToggleStar: handleToggleStar,
    onArchiveConversation: handleArchiveConversation,
    onUnarchiveConversation: handleUnarchiveConversation,
    onTrashConversation: handleTrashConversation,
    onRestoreConversation: handleRestoreConversation,
    onRefreshConversations: refreshConversations,
    streamControllerRef,
  }

  if (!isOpen) {
    return <RemiLauncher onClick={openWidget} hasUnread={hasUnread} />
  }

  // Widget open but auth still resolving / not signed in → show auth panel.
  if (!authChecked) {
    return <LoadingPanel message="Loading…" position={position} />
  }

  if (!user) {
    return <WidgetAuthPanel onSuccess={setUser} onClose={close} />
  }

  if (!chatReady) {
    return <LoadingPanel message="Loading chat…" position={position} />
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

function ChatbotWidgetRoot(props: ChatbotWidgetProps) {
  const { primaryColor = '#2979FF', position = 'bottom-right' } = props
  return (
    <div
      className="remi-widget-root text-[#1A1A1A] antialiased"
      style={{ ['--remi-accent' as string]: primaryColor }}
    >
      <WidgetThemeProvider primaryColor={primaryColor} position={position}>
        <ChatbotWidget {...props} />
      </WidgetThemeProvider>
    </div>
  )
}

export default ChatbotWidgetRoot
