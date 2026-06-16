import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Menu,
  ArrowLeft,
  Minimize2,
  X,
  Trash2,
  Search,
  Star,
  Check,
  LayoutList,
  LogOut,
} from 'lucide-react'
import { streamSendMessage } from './streamSend'
import { deleteFile, listFiles, uploadFile } from '../../api/files'
import ChatInterface from './ChatInterface'
import WidgetConversationDashboard from './WidgetConversationDashboard'
import RemiAvatar2D from './RemiAvatar2D'
import type { Message, Conversation, UploadedFile } from '../../types'
import FileUploadModal from './FileUploadModal'
import FileGenerationPanel from './FileGenerationPanel'
import MobileTabBar, { type MobileTabId } from './MobileTabBar'
import MobileConversationList from './MobileConversationList'
import MobileFilesPanel from './MobileFilesPanel'
import FileListItem from './FileListItem'
import { useIsMobile } from '../../hooks/useIsMobile'
import { NavTooltip, WidgetTooltipProvider } from './NavTooltip'

type View = 'chat' | 'dashboard'

function formatConvTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export type ExpandedWidgetProps = {
  conversation: Conversation | null
  messages: Message[]
  files: UploadedFile[]
  conversations: Conversation[]
  starredIds: Set<string>
  archivedIds: Set<string>
  trashedIds: Set<string>
  onMessagesChange: React.Dispatch<React.SetStateAction<Message[]>>
  onFilesChange: React.Dispatch<React.SetStateAction<UploadedFile[]>>
  onToggleStar: (id: string) => void
  onArchiveConversation: (id: string) => void
  onUnarchiveConversation: (id: string) => void
  onTrashConversation: (id: string) => void
  onRestoreConversation: (id: string) => void
  onRefreshConversations: () => Promise<Conversation[]>
  streamControllerRef?: React.MutableRefObject<AbortController | null>
  onSelectConversation: (conv: Conversation) => void | Promise<void>
  onNewConversation: () => void | Promise<void>
  onDeleteConversation: (id: string) => void | Promise<void>
  onRenameConversation: (title: string) => void
  onCollapse: () => void
  onClose: () => void
  onLogout?: () => void
}

export default function ExpandedWidget({
  conversation,
  messages,
  files,
  conversations,
  starredIds,
  archivedIds,
  trashedIds,
  onMessagesChange,
  onFilesChange,
  onToggleStar,
  onArchiveConversation,
  onUnarchiveConversation,
  onTrashConversation,
  onRestoreConversation,
  onRefreshConversations,
  streamControllerRef,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onRenameConversation,
  onCollapse,
  onClose,
  onLogout,
}: ExpandedWidgetProps) {
  const isMobile = useIsMobile()
  const [view, setView] = useState<View>('chat')
  const [mobileTab, setMobileTab] = useState<MobileTabId>('chat')
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const isSendingRef = useRef(false)
  const [showSaved, setShowSaved] = useState(false)
  const [search, setSearch] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileUploadOpen, setFileUploadOpen] = useState(false)
  const [rightTab, setRightTab] = useState<'files' | 'generate'>('files')
  const [rateLimitSeconds, setRateLimitSeconds] = useState(0)
  const [fileToast, setFileToast] = useState<{
    message: string
    type: 'success' | 'error'
  } | null>(null)
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fileToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setIsTyping(false)
    isSendingRef.current = false
  }, [conversation?.id])

  useEffect(() => {
    if (view === 'chat' && mobileTab === 'chat') {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isTyping, view, mobileTab])

  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
      if (fileToastTimerRef.current) clearTimeout(fileToastTimerRef.current)
    }
  }, [])

  const flashSaved = () => {
    setShowSaved(true)
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    savedTimerRef.current = setTimeout(() => setShowSaved(false), 2000)
  }

  const flashFileToast = (message: string, type: 'success' | 'error') => {
    setFileToast({ message, type })
    if (fileToastTimerRef.current) clearTimeout(fileToastTimerRef.current)
    fileToastTimerRef.current = setTimeout(() => setFileToast(null), 2500)
  }

  const handleOpenFileUploadModal = () => {
    if (!conversation) return
    setFileUploadOpen(true)
  }

  const handleUploadedFile = async (uploaded: UploadedFile) => {
    onFilesChange((prev) =>
      prev.some((f) => f.id === uploaded.id) ? prev : [...prev, uploaded],
    )
    if (!conversation) return
    try {
      const refreshed = await listFiles(conversation.id)
      onFilesChange(refreshed)
    } catch {
      // Keep optimistic entry; polling will retry while status is pending.
    }
  }

  const handleDeleteFile = useCallback(
    async (fileId: string) => {
      if (!conversation) return
      const snapshot = files
      onFilesChange((prev) => prev.filter((f) => f.id !== fileId))
      try {
        await deleteFile(conversation.id, fileId)
        flashFileToast('File deleted', 'success')
      } catch {
        onFilesChange(snapshot)
        flashFileToast('Could not delete file', 'error')
      }
    },
    [conversation, files, onFilesChange],
  )

  const handleSend = async () => {
    const content = input.trim()
    if (!content || !conversation) return
    setInput('')
    await streamSendMessage({
      conversation,
      content,
      isTyping,
      isSendingRef,
      streamControllerRef,
      onMessagesChange,
      onRefreshConversations,
      setIsTyping,
      onRateLimit: setRateLimitSeconds,
    })
    flashSaved()
  }

  const handleReplaceEditedMessage = (
    userMessageId: string,
    editedContent: string,
    newAssistant: Message,
  ) => {
    onMessagesChange((prev) => {
      const idx = prev.findIndex((m) => m.id === userMessageId)
      if (idx < 0) return prev

      const next = [...prev]
      next[idx] = { ...next[idx], content: editedContent }

      const assistantIdx = idx + 1
      if (next[assistantIdx] && next[assistantIdx].role === 'assistant') {
        next[assistantIdx] = newAssistant
      } else {
        next.splice(assistantIdx, 0, newAssistant)
      }
      return next
    })
    flashSaved()
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0] || !conversation) return
    const uploaded = await uploadFile(conversation.id, e.target.files[0])
    onFilesChange((prev) => [...prev, uploaded])
    e.target.value = ''
  }

  const handleDeleteActive = () => {
    if (conversation) void onDeleteConversation(conversation.id)
  }

  const openConversation = async (conv: Conversation) => {
    await onSelectConversation(conv)
    setView('chat')
    setMobileTab('chat')
  }

  const filtered = conversations.filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase()),
  )

  const showConvPanel =
    !isMobile || mobileTab === 'conversations'
  const showChatPanel = !isMobile || mobileTab === 'chat'
  const showFilesPanel = !isMobile || mobileTab === 'files'

  const conversationSidebar = (
    <>
      <div className="shrink-0 space-y-2 border-b border-[#F0F0F0] p-3">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#ACACAC]"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations"
            className="w-full rounded-lg border-0 bg-white py-2 pl-8 pr-3 text-base text-[#1A1A1A] outline-none placeholder:text-[#ACACAC] focus:ring-2 focus:ring-[#2979FF]/30 md:text-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => void onNewConversation()}
          className="min-h-[44px] w-full rounded-[10px] bg-[#2979FF] py-2 text-sm font-semibold text-white shadow-[0_2px_8px_rgba(41,121,255,0.3)] active:scale-[0.98] md:hover:bg-[#1565C0]"
        >
          + New Chat
        </button>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2 touch-scroll">
        {filtered.map((c) => {
          const starred = starredIds.has(c.id)
          const isActive = conversation?.id === c.id
          return (
            <div
              key={c.id}
              role="button"
              tabIndex={0}
              onClick={() => void openConversation(c)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  void openConversation(c)
                }
              }}
              className={`group relative flex min-h-[44px] cursor-pointer items-start gap-1.5 rounded-lg px-2.5 py-3 transition-colors duration-150 active:bg-[#F5F5F5] ${
                isActive
                  ? 'border-l-[3px] border-[#2979FF] bg-[#E3F2FD] pl-2'
                  : 'border-l-[3px] border-transparent md:hover:bg-[#F5F5F5]'
              }`}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleStar(c.id)
                }}
                className={`mt-0.5 shrink-0 rounded-md p-2 active:opacity-70 ${
                  starred
                    ? 'text-[#2979FF] opacity-100'
                    : 'text-[#ACACAC] opacity-100 md:opacity-0 md:group-hover:opacity-100'
                }`}
                aria-label={starred ? 'Unstar' : 'Star conversation'}
              >
                <Star size={13} fill={starred ? 'currentColor' : 'none'} />
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-1">
                  <p className="truncate text-[13px] font-medium text-[#1A1A1A]">
                    {c.title}
                  </p>
                  <span className="mt-0.5 shrink-0 text-[10px] text-[#ACACAC]">
                    {formatConvTime(c.created_at)}
                  </span>
                </div>
                <p className="truncate text-[11px] text-[#8C8C8C]">{c.title}</p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  void onDeleteConversation(c.id)
                }}
                className="mt-0.5 hidden shrink-0 p-2 text-[#ACACAC] active:text-red-500 md:group-hover:flex md:hover:text-red-500"
                aria-label="Delete conversation"
              >
                <Trash2 size={13} />
              </button>
            </div>
          )
        })}
      </nav>
      <div className="shrink-0 border-t border-[#F0F0F0] p-2">
        <button
          type="button"
          onClick={() => {
            void onRefreshConversations()
            setView('dashboard')
          }}
          className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium text-[#1565C0] active:bg-[#E3F2FD] md:hover:bg-[#E3F2FD]"
        >
          <LayoutList size={16} />
          View All Conversations
        </button>
      </div>
    </>
  )

  const filesSidebar = (
    <>
      <div className="flex shrink-0 items-center gap-2 border-b border-[#F0F0F0] px-3 py-2">
        <button
          type="button"
          onClick={() => setRightTab('files')}
          className={`min-h-[44px] rounded-lg px-3 py-1.5 text-sm font-medium transition-colors active:opacity-80 ${
            rightTab === 'files'
              ? 'border border-[#F0F0F0] bg-white text-[#1A1A1A] shadow-sm'
              : 'text-[#8C8C8C] md:hover:text-[#1A1A1A]'
          }`}
        >
          Files
        </button>
        <button
          type="button"
          onClick={() => setRightTab('generate')}
          className={`min-h-[44px] rounded-lg px-3 py-1.5 text-sm font-medium transition-colors active:opacity-80 ${
            rightTab === 'generate'
              ? 'border border-[#F0F0F0] bg-white text-[#1A1A1A] shadow-sm'
              : 'text-[#8C8C8C] md:hover:text-[#1A1A1A]'
          }`}
        >
          Generate
        </button>
      </div>

      {rightTab === 'files' ? (
        <>
          <div className="shrink-0 border-b border-[#F0F0F0] px-4 py-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-[#1A1A1A]">
                Uploaded Files ({files.length})
              </p>
              <button
                type="button"
                onClick={handleOpenFileUploadModal}
                disabled={!conversation}
                className="min-h-[44px] text-xs font-semibold text-[#1565C0] active:text-[#0D47A1] disabled:opacity-40 md:hover:text-[#0D47A1]"
              >
                + Add More
              </button>
            </div>
            <p className="mt-0.5 text-xs text-[#8C8C8C]">Used for document Q&amp;A</p>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto p-3 touch-scroll">
            {files.length === 0 && (
              <p className="mt-6 text-center text-xs text-[#8C8C8C]">
                No files yet. Upload a PDF, DOCX, or TXT to chat with your documents.
              </p>
            )}
            {files.map((f) => (
              <FileListItem
                key={f.id}
                file={f}
                onDelete={handleDeleteFile}
                compact
              />
            ))}
          </div>
        </>
      ) : (
        <FileGenerationPanel conversation={conversation} messages={messages} />
      )}
    </>
  )

  const sidebarHint =
    isMobile && mobileTab === 'conversations'
      ? 'Return to the active chat'
      : isMobile
        ? 'Browse and switch conversations'
        : 'Show or hide conversation list'

  return (
    <WidgetTooltipProvider>
    <div className="fixed inset-0 z-50 flex flex-col bg-white animate-widgetIn max-md:rounded-none md:inset-4 md:rounded-2xl md:shadow-2xl">
      <header className="relative grid h-14 shrink-0 grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-1 border-b border-[#F0F0F0] bg-gradient-to-b from-white to-[#FAFAFA] px-2 md:flex md:justify-between md:px-4">
        <div className="flex justify-start md:contents">
          {view === 'chat' ? (
            <NavTooltip
              label={
                isMobile && mobileTab === 'conversations' ? 'Back to chat' : 'Conversations'
              }
              description={sidebarHint}
              side="bottom"
            >
              <button
                type="button"
                onClick={() => {
                  if (isMobile) {
                    if (mobileTab === 'conversations') {
                      setMobileTab('chat')
                    } else {
                      setMobileTab('conversations')
                    }
                    setView('chat')
                  } else {
                    setSidebarOpen((p) => !p)
                  }
                }}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[#8C8C8C] active:bg-[#F5F5F5] md:min-h-[44px] md:min-w-[44px] md:p-1.5 md:hover:bg-[#F5F5F5] md:hover:text-[#1A1A1A]"
                aria-label={
                  isMobile && mobileTab === 'conversations'
                    ? 'Back to chat'
                    : isMobile
                      ? 'Open conversations'
                      : 'Toggle sidebar'
                }
              >
                {isMobile && mobileTab === 'conversations' ? (
                  <ArrowLeft size={18} />
                ) : (
                  <Menu size={18} />
                )}
              </button>
            </NavTooltip>
          ) : (
            <div className="h-10 w-10 shrink-0 md:h-11 md:w-11" />
          )}
        </div>

        <div className="flex min-w-0 items-center justify-center gap-1.5 px-0.5 md:absolute md:left-1/2 md:-translate-x-1/2 md:gap-2">
          <RemiAvatar2D size={isMobile ? 28 : 36} className="shrink-0" />
          <div className="min-w-0 text-center leading-tight md:text-left">
            <p className="truncate text-sm font-semibold text-[#1A1A1A]">
              {isMobile ? 'Remi Chat' : 'Remi'}
            </p>
            <p className="flex items-center justify-center gap-1 text-[10px] text-[#8C8C8C] md:text-xs">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#22C55E]" />
              <span className="truncate">Online</span>
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-0.5 md:gap-1">
          {view === 'chat' && showSaved && (
            <span className="mr-1 hidden animate-fadeIn items-center gap-1 text-xs font-medium text-[#22C55E] sm:flex">
              <Check size={14} />
              Saved
            </span>
          )}
          {fileToast && (
            <span
              className={`mr-1 hidden animate-fadeIn items-center gap-1 text-xs font-medium sm:flex ${
                fileToast.type === 'success' ? 'text-[#22C55E]' : 'text-red-500'
              }`}
            >
              {fileToast.type === 'success' ? <Check size={14} /> : <X size={14} />}
              {fileToast.message}
            </span>
          )}
          {onLogout && (
            <NavTooltip label="Sign out" description="Log out of your account" side="bottom">
              <button
                type="button"
                onClick={onLogout}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[#8C8C8C] active:bg-[#F5F5F5] md:min-h-[44px] md:min-w-[44px] md:p-1.5 md:hover:bg-[#F5F5F5] md:hover:text-[#1A1A1A]"
                aria-label="Sign out"
              >
                <LogOut size={17} />
              </button>
            </NavTooltip>
          )}
          <NavTooltip
            label="Compact view"
            description="Shrink to the small floating widget"
            side="bottom"
          >
            <button
              type="button"
              onClick={onCollapse}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[#8C8C8C] active:bg-[#F5F5F5] md:min-h-[44px] md:min-w-[44px] md:p-1.5 md:hover:bg-[#F5F5F5] md:hover:text-[#1A1A1A]"
              aria-label="Collapse to compact widget"
            >
              <Minimize2 size={17} />
            </button>
          </NavTooltip>
          <NavTooltip label="Close" description="Hide the chat widget" side="bottom">
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[#8C8C8C] active:bg-[#F5F5F5] md:min-h-[44px] md:min-w-[44px] md:p-1.5 md:hover:bg-[#F5F5F5] md:hover:text-[#1A1A1A]"
              aria-label="Close widget"
            >
              <X size={18} />
            </button>
          </NavTooltip>
        </div>
      </header>

      {view === 'dashboard' ? (
        <WidgetConversationDashboard
          starredIds={starredIds}
          archivedIds={archivedIds}
          trashedIds={trashedIds}
          onToggleStar={onToggleStar}
          onSelectConversation={(conv) => void openConversation(conv)}
          onBack={() => setView('chat')}
        />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden max-md:pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))]">
          {isMobile ? (
            <div className="relative flex min-h-0 flex-1 overflow-hidden">
              {showConvPanel && (
                <aside className="absolute inset-0 z-10 flex min-h-0 flex-col bg-[#FAFAFA]">
                  <MobileConversationList
                    conversations={conversations}
                    starredIds={starredIds}
                    archivedIds={archivedIds}
                    trashedIds={trashedIds}
                    activeId={conversation?.id}
                    search={search}
                    onSearchChange={setSearch}
                    onNewConversation={() => void onNewConversation()}
                    onSelectConversation={(conv) => void openConversation(conv)}
                    onToggleStar={onToggleStar}
                    onArchiveConversation={onArchiveConversation}
                    onUnarchiveConversation={onUnarchiveConversation}
                    onTrashConversation={onTrashConversation}
                    onRestoreConversation={onRestoreConversation}
                    onDeleteConversation={(id) => void onDeleteConversation(id)}
                    onViewAllDashboard={() => {
                      void onRefreshConversations()
                      setView('dashboard')
                    }}
                  />
                </aside>
              )}
              {showChatPanel && (
                <div className="absolute inset-0 z-10 flex min-h-0 min-w-0 flex-col bg-white">
                  <ChatInterface
                    conversation={conversation}
                    messages={messages}
                    input={input}
                    onInputChange={setInput}
                    onSend={handleSend}
                    isTyping={isTyping}
                    onRenameTitle={onRenameConversation}
                    onDeleteConversation={handleDeleteActive}
                    onReplaceEditedMessage={handleReplaceEditedMessage}
                    onOpenFileUploadModal={handleOpenFileUploadModal}
                    fileInputRef={fileRef}
                    onFileChange={handleFile}
                    bottomRef={bottomRef}
                    mobileLayout
                    rateLimitSeconds={rateLimitSeconds}
                    onRateLimitExpired={() => setRateLimitSeconds(0)}
                    uploadedFileCount={files.length}
                    onViewFiles={() => setMobileTab('files')}
                  />
                </div>
              )}
              {showFilesPanel && (
                <aside className="absolute inset-0 z-10 flex min-h-0 flex-col bg-[#FAFAFA]">
                  <MobileFilesPanel
                    conversation={conversation}
                    messages={messages}
                    files={files}
                    onAddMore={handleOpenFileUploadModal}
                    onDeleteFile={handleDeleteFile}
                  />
                </aside>
              )}
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 overflow-hidden">
              <aside
                className={`flex min-h-0 flex-col border-[#F0F0F0] bg-[#FAFAFA] ${
                  sidebarOpen
                    ? 'hidden md:flex md:w-1/3 md:max-w-[280px] md:border-r lg:w-1/4'
                    : 'hidden'
                }`}
              >
                {conversationSidebar}
              </aside>

              <div className="flex min-h-0 min-w-0 flex-1 flex-col border-r border-[#F0F0F0]">
                <ChatInterface
                  conversation={conversation}
                  messages={messages}
                  input={input}
                  onInputChange={setInput}
                  onSend={handleSend}
                  isTyping={isTyping}
                  onRenameTitle={onRenameConversation}
                  onDeleteConversation={handleDeleteActive}
                  onReplaceEditedMessage={handleReplaceEditedMessage}
                  onOpenFileUploadModal={handleOpenFileUploadModal}
                  fileInputRef={fileRef}
                  onFileChange={handleFile}
                  bottomRef={bottomRef}
                  mobileLayout={false}
                  rateLimitSeconds={rateLimitSeconds}
                  onRateLimitExpired={() => setRateLimitSeconds(0)}
                  uploadedFileCount={files.length}
                  onViewFiles={() => setRightTab('files')}
                />
              </div>

              <aside className="hidden min-h-0 flex-col bg-[#FAFAFA] lg:flex lg:w-1/4 lg:max-w-[320px] lg:border-l lg:border-[#F0F0F0]">
                {filesSidebar}
              </aside>
            </div>
          )}

          <MobileTabBar
            active={mobileTab}
            onChange={setMobileTab}
            fileCount={files.length}
          />
        </div>
      )}

      {fileUploadOpen && conversation && (
        <FileUploadModal
          open={fileUploadOpen}
          conversationId={conversation.id}
          files={files}
          onClose={() => setFileUploadOpen(false)}
          onUploaded={handleUploadedFile}
        />
      )}
    </div>
    </WidgetTooltipProvider>
  )
}
