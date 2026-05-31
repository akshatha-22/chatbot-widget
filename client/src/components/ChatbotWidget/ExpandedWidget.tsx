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
  Loader2,
  LayoutList,
  LogOut,
} from 'lucide-react'
import { streamMessage } from '../../api/chat'
import { generatePDFFromContent } from '../../utils/pdfGenerator'
import { uploadFile } from '../../api/files'
import ChatInterface from './ChatInterface'
import WidgetConversationDashboard from './WidgetConversationDashboard'
import RemiAvatar2D from './RemiAvatar2D'
import type { Message, Conversation, UploadedFile } from '../../types'
import FileUploadModal from './FileUploadModal'
import FileGenerationPanel from './FileGenerationPanel'

type View = 'chat' | 'dashboard'

const FILE_TYPE_COLORS: Record<string, string> = {
  pdf: '#EF4444',
  doc: '#3B82F6',
  docx: '#3B82F6',
  xls: '#22C55E',
  xlsx: '#22C55E',
  csv: '#22C55E',
  txt: '#8C8C8C',
  md: '#8C8C8C',
}

function fileIconColor(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  return FILE_TYPE_COLORS[ext] ?? '#8C8C8C'
}

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
  onLogout?: () => void
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
  onLogout,
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

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white animate-widgetIn">
      <div className="h-14 flex items-center justify-between px-4 shrink-0 relative border-b border-[#F0F0F0] bg-gradient-to-b from-white to-[#FAFAFA]">
        {view === 'chat' ? (
          <button
            type="button"
            onClick={() => setSidebarOpen((p) => !p)}
            className="p-1.5 rounded-lg text-[#8C8C8C] hover:bg-[#F5F5F5] hover:text-[#1A1A1A] transition-colors"
            aria-label="Toggle sidebar"
          >
            <Menu size={20} />
          </button>
        ) : (
          <div className="w-5" />
        )}
        <div className="flex items-center gap-2 absolute left-1/2 -translate-x-1/2">
          <RemiAvatar2D size={36} />
          <div>
            <p className="text-sm font-semibold text-[#1A1A1A]">Remi</p>
            <p className="flex items-center gap-1 text-xs text-[#8C8C8C]">
              <span className="h-2 w-2 rounded-full bg-[#22C55E]" />
              Online
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {view === 'chat' && showSaved && (
            <span className="flex items-center gap-1 text-xs text-[#22C55E] font-medium animate-fadeIn">
              <Check size={14} />
              Saved
            </span>
          )}
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="p-1.5 rounded-lg text-[#8C8C8C] hover:bg-[#F5F5F5] hover:text-[#1A1A1A] transition-colors"
              aria-label="Sign out"
            >
              <LogOut size={18} />
            </button>
          )}
          <button
            type="button"
            onClick={onCollapse}
            className="p-1.5 rounded-lg text-[#8C8C8C] hover:bg-[#F5F5F5] hover:text-[#1A1A1A] transition-colors"
            aria-label="Collapse"
          >
            <Minimize2 size={18} />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8C8C8C] hover:bg-[#F5F5F5] hover:text-[#1A1A1A] transition-colors"
            aria-label="Close"
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
            <aside className="w-1/4 min-w-[200px] max-w-[280px] border-r border-[#F0F0F0] bg-[#FAFAFA] flex flex-col">
              <div className="p-3 space-y-2 border-b border-[#F0F0F0]">
                <div className="relative">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[#ACACAC]"
                  />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search conversations"
                    className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border-0 bg-white text-[#1A1A1A] placeholder:text-[#ACACAC] outline-none focus:ring-2 focus:ring-[#F59E0B]/30"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void onNewConversation()}
                  className="w-full py-2 rounded-[10px] bg-[#F59E0B] text-white text-sm font-semibold hover:bg-[#D97706] active:scale-[0.98] transition-all shadow-[0_2px_8px_rgba(245,158,11,0.3)]"
                >
                  + New Chat
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
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
                      className={`group relative flex items-start gap-1.5 rounded-lg px-2.5 py-2 cursor-pointer transition-colors duration-150 ${
                        isActive
                          ? 'bg-[#FFFBF0] border-l-[3px] border-[#F59E0B] pl-2'
                          : 'border-l-[3px] border-transparent hover:bg-[#F5F5F5]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onToggleStar(c.id)
                        }}
                        className={`p-0.5 rounded-md shrink-0 mt-0.5 ${
                          starred
                            ? 'text-[#F59E0B] opacity-100'
                            : 'text-[#ACACAC] hover:text-[#8C8C8C] opacity-0 group-hover:opacity-100'
                        }`}
                        aria-label={starred ? 'Unstar' : 'Star conversation'}
                      >
                        <Star size={13} fill={starred ? 'currentColor' : 'none'} />
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-1">
                          <p className="text-[13px] font-medium text-[#1A1A1A] truncate">
                            {c.title}
                          </p>
                          <span className="text-[10px] text-[#ACACAC] shrink-0 mt-0.5">
                            {formatConvTime(c.created_at)}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#8C8C8C] truncate">
                          {c.title}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          void onDeleteConversation(c.id)
                        }}
                        className="hidden group-hover:flex text-[#ACACAC] hover:text-red-500 shrink-0 mt-0.5"
                        aria-label="Delete conversation"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )
                })}
              </nav>
              <div className="p-2 border-t border-[#F0F0F0]">
                <button
                  type="button"
                  onClick={() => {
                    void onRefreshConversations()
                    setView('dashboard')
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2 text-sm text-[#D97706] hover:bg-[#FFFBF0] rounded-lg font-medium transition-colors"
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

          <aside className="w-1/4 min-w-[200px] max-w-[320px] bg-[#FAFAFA] flex flex-col border-l border-[#F0F0F0]">
            <div className="px-3 py-2 border-b border-[#F0F0F0] flex items-center gap-2">
              <button
                type="button"
                onClick={() => setRightTab('files')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  rightTab === 'files'
                    ? 'bg-white border border-[#F0F0F0] text-[#1A1A1A] shadow-sm'
                    : 'text-[#8C8C8C] hover:text-[#1A1A1A]'
                }`}
              >
                Files
              </button>
              <button
                type="button"
                onClick={() => setRightTab('generate')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  rightTab === 'generate'
                    ? 'bg-white border border-[#F0F0F0] text-[#1A1A1A] shadow-sm'
                    : 'text-[#8C8C8C] hover:text-[#1A1A1A]'
                }`}
              >
                Generate
              </button>
            </div>

            {rightTab === 'files' ? (
              <>
                <div className="px-4 py-3 border-b border-[#F0F0F0]">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-[#1A1A1A]">
                      Uploaded Files ({files.length})
                    </p>
                    <button
                      type="button"
                      onClick={handleOpenFileUploadModal}
                      disabled={!conversation}
                      className="text-xs font-semibold text-[#D97706] hover:text-[#B45309] disabled:opacity-40"
                    >
                      + Add More
                    </button>
                  </div>
                  <p className="text-xs text-[#8C8C8C] mt-0.5">
                    Used for document Q&amp;A
                  </p>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {files.length === 0 && (
                    <p className="text-xs text-[#8C8C8C] text-center mt-6">
                      No files yet. Upload a PDF, DOCX, or TXT to chat with your
                      documents.
                    </p>
                  )}
                  {files.map((f) => {
                    const processed = f.status === 'processed'
                    return (
                      <div
                        key={f.id}
                        className="flex items-center gap-2.5 bg-white rounded-[8px] border border-[#F0F0F0] px-3 py-2.5 transition-shadow hover:shadow-[0_2px_10px_rgba(0,0,0,0.06)]"
                      >
                        <FileText
                          size={16}
                          className="shrink-0"
                          style={{ color: fileIconColor(f.filename) }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-[#1A1A1A] truncate">
                            {f.filename}
                          </p>
                          <p
                            className={`flex items-center gap-1 text-[11px] ${
                              processed ? 'text-[#22C55E]' : 'text-[#F59E0B]'
                            }`}
                          >
                            {processed ? (
                              <>
                                <Check size={11} /> Ready
                              </>
                            ) : (
                              <>
                                <Loader2 size={11} className="animate-spin" /> Processing
                              </>
                            )}
                          </p>
                        </div>
                      </div>
                    )
                  })}
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
