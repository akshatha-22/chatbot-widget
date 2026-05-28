import { useState, useEffect, useRef } from 'react'
import {
  Menu,
  Minimize2,
  X,
  Trash2,
  FileText,
  Search,
  Star,
  Check,
  LayoutList,
} from 'lucide-react'
import { streamMessage } from '../../api/chat'
import { uploadFile } from '../../api/files'
import ChatInterface from './ChatInterface'
import WidgetConversationDashboard from './WidgetConversationDashboard'
import type { Message, Conversation, UploadedFile } from '../../types'
import FileUploadModal from './FileUploadModal'
import FileGenerationPanel from './FileGenerationPanel'

type View = 'chat' | 'dashboard'

export type ExpandedWidgetProps = {
  conversation: Conversation | null
  messages: Message[]
  files: UploadedFile[]
  conversations: Conversation[]
  starredIds: Set<string>
  onMessagesChange: React.Dispatch<React.SetStateAction<Message[]>>
  onFilesChange: React.Dispatch<React.SetStateAction<UploadedFile[]>>
  onToggleStar: (id: string) => void
  onRefreshConversations: () => Promise<Conversation[]>
  onSelectConversation: (conv: Conversation) => void | Promise<void>
  onNewConversation: () => void | Promise<void>
  onDeleteConversation: (id: string) => void | Promise<void>
  onRenameConversation: (title: string) => void
  onCollapse: () => void
  onClose: () => void
}

export default function ExpandedWidget({
  conversation,
  messages,
  files,
  conversations,
  starredIds,
  onMessagesChange,
  onFilesChange,
  onToggleStar,
  onRefreshConversations,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onRenameConversation,
  onCollapse,
  onClose,
}: ExpandedWidgetProps) {
  const [view, setView] = useState<View>('chat')
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [showSaved, setShowSaved] = useState(false)
  const [search, setSearch] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileUploadOpen, setFileUploadOpen] = useState(false)
  const [rightTab, setRightTab] = useState<'files' | 'generate'>('files')
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (view === 'chat') {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isTyping, view])

  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    }
  }, [])

  const flashSaved = () => {
    setShowSaved(true)
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    savedTimerRef.current = setTimeout(() => setShowSaved(false), 2000)
  }

  const handleOpenFileUploadModal = () => {
    if (!conversation) return
    setFileUploadOpen(true)
  }

  const handleUploadedFile = (uploaded: UploadedFile) => {
    onFilesChange((prev) =>
      prev.some((f) => f.id === uploaded.id) ? prev : [...prev, uploaded],
    )
  }

  const handleSend = async () => {
    const content = input.trim()
    if (!content || !conversation || isTyping) return

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    }
    const assistantId = `stream-${Date.now()}`

    onMessagesChange((prev) => [...prev, userMsg])
    setInput('')
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
          onMessagesChange((prev) =>
            prev.map((m) => (m.id === assistantId ? msg : m)),
          )
          flashSaved()
          void onRefreshConversations()
        },
      })
    } catch {
      onMessagesChange((prev) => prev.filter((m) => m.id !== assistantId))
    } finally {
      setIsTyping(false)
    }
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
  }

  const filtered = conversations.filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase()),
  )

  const headerTitle =
    view === 'dashboard' ? 'All Conversations' : conversation?.title ?? 'Remi Chat'

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <div className="bg-indigo-500 h-14 flex items-center justify-between px-4 shrink-0 relative">
        {view === 'chat' ? (
          <button
            type="button"
            onClick={() => setSidebarOpen((p) => !p)}
            className="text-white/80 hover:text-white"
          >
            <Menu size={20} />
          </button>
        ) : (
          <div className="w-5" />
        )}
        <span className="text-white font-semibold text-base absolute left-1/2 -translate-x-1/2 truncate max-w-[50%]">
          {headerTitle}
        </span>
        <div className="flex items-center gap-3">
          {view === 'chat' && showSaved && (
            <span className="flex items-center gap-1 text-xs text-white/95 font-medium animate-fadeIn">
              <Check size={14} className="text-green-300" />
              Saved
            </span>
          )}
          <button
            type="button"
            onClick={onCollapse}
            className="text-white/80 hover:text-white"
          >
            <Minimize2 size={18} />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="text-white/80 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {view === 'dashboard' ? (
        <WidgetConversationDashboard
          starredIds={starredIds}
          onToggleStar={onToggleStar}
          onSelectConversation={(conv) => void openConversation(conv)}
          onBack={() => setView('chat')}
        />
      ) : (
        <div className="flex flex-1 overflow-hidden min-h-0">
          {sidebarOpen && (
            <aside className="w-1/4 min-w-[200px] max-w-[280px] border-r border-gray-200 bg-gray-50 flex flex-col">
              <div className="p-3 space-y-2 border-b border-gray-200">
                <div className="relative">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search conversations"
                    className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-gray-200 bg-white outline-none focus:border-indigo-400"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void onNewConversation()}
                  className="w-full py-1.5 rounded-lg bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-600"
                >
                  + New Chat
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto p-2 space-y-1">
                {filtered.map((c) => {
                  const starred = starredIds.has(c.id)
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
                      className={`group flex items-center gap-1 rounded-lg px-2 py-2 text-sm cursor-pointer ${
                        conversation?.id === c.id
                          ? 'bg-indigo-50 text-indigo-700'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onToggleStar(c.id)
                        }}
                        className={`p-1 rounded-md shrink-0 ${
                          starred
                            ? 'text-yellow-500'
                            : 'text-gray-300 hover:text-gray-500 opacity-0 group-hover:opacity-100'
                        } ${starred ? 'opacity-100' : ''}`}
                        aria-label={starred ? 'Unstar' : 'Star conversation'}
                      >
                        <Star size={14} fill={starred ? 'currentColor' : 'none'} />
                      </button>
                      <span className="truncate flex-1">{c.title}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          void onDeleteConversation(c.id)
                        }}
                        className="hidden group-hover:flex text-gray-400 hover:text-red-500 shrink-0"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )
                })}
              </nav>
              <div className="p-2 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    void onRefreshConversations()
                    setView('dashboard')
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg font-medium"
                >
                  <LayoutList size={16} />
                  View All Conversations
                </button>
              </div>
            </aside>
          )}

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
          />

          <aside className="w-1/4 min-w-[200px] max-w-[320px] bg-gray-50 flex flex-col border-l border-gray-200">
            <div className="px-3 py-2 border-b border-gray-200 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setRightTab('files')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                  rightTab === 'files'
                    ? 'bg-white border border-gray-200 text-gray-800'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                Files
              </button>
              <button
                type="button"
                onClick={() => setRightTab('generate')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                  rightTab === 'generate'
                    ? 'bg-white border border-gray-200 text-gray-800'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                Generate
              </button>
            </div>

            {rightTab === 'files' ? (
              <>
                <div className="px-4 py-3 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-700">
                      Uploaded Files ({files.length})
                    </p>
                    <button
                      type="button"
                      onClick={handleOpenFileUploadModal}
                      disabled={!conversation}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 disabled:opacity-40"
                    >
                      + Add More
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Used for document Q&amp;A
                  </p>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {files.length === 0 && (
                    <p className="text-xs text-gray-400 text-center mt-6">
                      No files yet. Upload a PDF, DOCX, or TXT to chat with your
                      documents.
                    </p>
                  )}
                  {files.map((f) => (
                    <div
                      key={f.id}
                      className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 px-3 py-2"
                    >
                      <FileText size={14} className="text-indigo-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-700 truncate">
                          {f.filename}
                        </p>
                        <p
                          className={`text-xs ${
                            f.status === 'processed'
                              ? 'text-green-500'
                              : 'text-amber-500'
                          }`}
                        >
                          {f.status === 'processed' ? '✓ Ready' : '⏳ Processing'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <FileGenerationPanel conversation={conversation} messages={messages} />
            )}
          </aside>
        </div>
      )}

      {fileUploadOpen && conversation && (
        <FileUploadModal
          open={fileUploadOpen}
          conversationId={conversation.id}
          onClose={() => setFileUploadOpen(false)}
          onUploaded={handleUploadedFile}
        />
      )}
    </div>
  )
}
