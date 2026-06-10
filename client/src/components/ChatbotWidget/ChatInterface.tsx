import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Search,
  Share2,
  Trash2,
  MoreVertical,
  Pencil,
  Copy,
  ThumbsUp,
  ThumbsDown,
  Paperclip,
  Send,
  Mic,
  Check,
  X,
  Download,
} from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import type { Message, Conversation } from '../../types'
import { generatePDFFromContent } from '../../utils/pdfGenerator'
import MessageEditModal from './MessageEditModal'
import AssistantMarkdown from './AssistantMarkdown'
import RemiAvatar2D from './RemiAvatar2D'
import { RateLimitBanner } from './RateLimitBanner'
import { NavTooltip } from './NavTooltip'

const MAX_INPUT_LENGTH = 2000

function formatMessageTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

function dayKey(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toDateString()
}

function formatDateDivider(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

function DateDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 my-3">
      <div className="flex-1 h-px bg-[#F0F0F0]" />
      <span className="text-[10px] text-[#ACACAC] font-medium">{label}</span>
      <div className="flex-1 h-px bg-[#F0F0F0]" />
    </div>
  )
}

export interface ChatInterfaceProps {
  conversation: Conversation | null
  messages: Message[]
  input: string
  onInputChange: (value: string) => void
  onSend: () => void
  isTyping?: boolean
  onRenameTitle?: (title: string) => void
  onDeleteConversation?: () => void
  onReplaceEditedMessage?: (
    userMessageId: string,
    editedContent: string,
    newAssistant: Message,
  ) => void
  onOpenFileUploadModal?: () => void
  fileInputRef?: React.RefObject<HTMLInputElement | null>
  onFileChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  bottomRef?: React.RefObject<HTMLDivElement | null>
  showWelcome?: boolean
  /** Hide conversation header (e.g. inside ConversationDetail). */
  embedded?: boolean
  /** Full-width bubbles + 16px inputs on viewports &lt; 768px */
  mobileLayout?: boolean
  rateLimitSeconds?: number
  onRateLimitExpired?: () => void
  uploadedFileCount?: number
  onViewFiles?: () => void
}

export default function ChatInterface({
  conversation,
  messages,
  input,
  onInputChange,
  onSend,
  isTyping = false,
  onRenameTitle,
  onDeleteConversation,
  onReplaceEditedMessage,
  onOpenFileUploadModal,
  fileInputRef,
  onFileChange,
  bottomRef,
  showWelcome = true,
  embedded = false,
  mobileLayout = false,
  rateLimitSeconds = 0,
  onRateLimitExpired,
  uploadedFileCount = 0,
  onViewFiles,
}: ChatInterfaceProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [chatSearchOpen, setChatSearchOpen] = useState(false)
  const [chatSearchQuery, setChatSearchQuery] = useState('')
  const [messageFilter, setMessageFilter] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<Record<string, 'up' | 'down'>>({})
  const [editOpen, setEditOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Message | null>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditingTitle) {
      titleInputRef.current?.focus()
      titleInputRef.current?.select()
    }
  }, [isEditingTitle])

  useEffect(() => {
    if (!isEditingTitle && conversation) {
      setTitleDraft(conversation.title)
    }
  }, [conversation?.title, conversation?.id, isEditingTitle])

  const startRename = () => {
    if (!conversation) return
    setTitleDraft(conversation.title)
    setIsEditingTitle(true)
  }

  const commitRename = () => {
    const trimmed = titleDraft.trim()
    if (trimmed && conversation && trimmed !== conversation.title) {
      onRenameTitle?.(trimmed)
    }
    setIsEditingTitle(false)
  }

  const cancelRename = () => {
    setTitleDraft(conversation?.title ?? '')
    setIsEditingTitle(false)
  }

  const handleCopy = useCallback(async (message: Message) => {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopiedId(message.id)
      window.setTimeout(() => setCopiedId(null), 2000)
    } catch {
      /* clipboard unavailable */
    }
  }, [])

  const handleShare = useCallback(async () => {
    if (!conversation) return
    const lines = messages.map(
      (m) => `${m.role === 'user' ? 'You' : 'Remi'}: ${m.content}`,
    )
    const text = `${conversation.title}\n\n${lines.join('\n\n')}`
    try {
      if (navigator.share) {
        await navigator.share({ title: conversation.title, text })
      } else {
        await navigator.clipboard.writeText(text)
      }
    } catch {
      /* user cancelled or unavailable */
    }
  }, [conversation, messages])

  const handleSearchToggle = () => {
    setChatSearchOpen((open) => {
      if (open) setMessageFilter('')
      return !open
    })
  }

  const applyChatSearch = () => {
    setMessageFilter(chatSearchQuery.trim())
    setChatSearchOpen(false)
  }

  const filteredMessages = messageFilter
    ? messages.filter((m) =>
        m.content.toLowerCase().includes(messageFilter.toLowerCase()),
      )
    : messages

  const handleInputChange = (value: string) => {
    if (value.length <= MAX_INPUT_LENGTH) {
      onInputChange(value)
    }
  }

  const canSend =
    input.trim().length > 0 && !isTyping && Boolean(conversation)

  const handleFileBadgeClick = () => {
    if (!conversation) return
    if (uploadedFileCount === 0 && onOpenFileUploadModal) {
      onOpenFileUploadModal()
      return
    }
    if (onViewFiles) {
      onViewFiles()
      return
    }
    onOpenFileUploadModal?.()
  }

  const fileBadgeEnabled = Boolean(
    conversation && (onOpenFileUploadModal || onViewFiles),
  )

  const openEditForMessage = (m: Message) => {
    setEditTarget(m)
    setEditOpen(true)
  }

  const closeEdit = () => {
    setEditOpen(false)
    // Keep editTarget for a moment so it doesn't flash; clear after close.
    window.setTimeout(() => setEditTarget(null), 0)
  }

  const Wrapper = embedded ? 'div' : 'main'
  const wrapperClass = embedded
    ? 'flex-1 flex flex-col min-h-0 min-w-0 bg-white'
    : 'flex-1 flex flex-col min-h-0 min-w-0 bg-white'

  return (<>
    <Wrapper className={wrapperClass}>
      {/* Conversation header */}
      {!embedded && (
      <header className="shrink-0 border-b border-[#F0F0F0] px-3 py-2 sm:px-4 sm:py-3">
        <div className="flex items-start gap-2 min-w-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 min-w-0">
              {isEditingTitle ? (
                <div className="flex items-center gap-1 flex-1 min-w-0">
                  <input
                    ref={titleInputRef}
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename()
                      if (e.key === 'Escape') cancelRename()
                    }}
                    className="flex-1 min-w-0 text-sm font-semibold text-[#1A1A1A] border border-[#2979FF]/40 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-[#2979FF]/40"
                    maxLength={120}
                  />
                  <NavTooltip label="Save title" description="Apply the new name">
                    <button
                      type="button"
                      onClick={commitRename}
                      className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-md text-[#1565C0] hover:bg-[#E3F2FD]"
                      aria-label="Save title"
                    >
                      <Check size={16} />
                    </button>
                  </NavTooltip>
                  <NavTooltip label="Cancel" description="Discard name changes">
                    <button
                      type="button"
                      onClick={cancelRename}
                      className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-md text-[#8C8C8C] hover:bg-[#F5F5F5]"
                      aria-label="Cancel rename"
                    >
                      <X size={16} />
                    </button>
                  </NavTooltip>
                </div>
              ) : (
                <>
                  <h2 className="text-sm font-semibold text-[#1A1A1A] truncate">
                    {conversation?.title ?? 'New Chat'}
                  </h2>
                  <NavTooltip
                    label="Rename"
                    description="Change this conversation title"
                  >
                    <button
                      type="button"
                      onClick={startRename}
                      disabled={!conversation}
                      className="flex min-h-[36px] min-w-[36px] shrink-0 items-center justify-center rounded-md text-[#8C8C8C] hover:text-[#1565C0] hover:bg-[#E3F2FD] disabled:opacity-40"
                      aria-label="Rename conversation"
                    >
                      <Pencil size={14} />
                    </button>
                  </NavTooltip>
                </>
              )}
            </div>

            {conversation && (
              <button
                type="button"
                onClick={handleFileBadgeClick}
                disabled={!fileBadgeEnabled}
                className="mt-1 inline-flex max-w-full items-center gap-1 rounded-full border border-[#E3F2FD] bg-[#F8FBFF] px-2 py-0.5 text-[10px] font-medium text-[#1565C0] transition-colors hover:bg-[#E3F2FD] active:scale-[0.98] disabled:cursor-default disabled:opacity-70 sm:text-[11px]"
                aria-label={
                  uploadedFileCount === 0
                    ? 'Upload a document'
                    : `${uploadedFileCount} files uploaded — view files`
                }
              >
                <Paperclip size={11} className="shrink-0" />
                <span className="truncate">
                  {uploadedFileCount === 0
                    ? 'No files yet — tap to upload'
                    : `${uploadedFileCount} file${uploadedFileCount === 1 ? '' : 's'} uploaded`}
                </span>
              </button>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-0.5">
            <NavTooltip
              label="Search messages"
              description="Find text in this conversation"
              side="bottom"
            >
              <button
                type="button"
                onClick={handleSearchToggle}
                className={`flex min-h-[40px] min-w-[40px] sm:min-h-[44px] sm:min-w-[44px] items-center justify-center rounded-lg p-2 transition-colors active:bg-[#E3F2FD] ${
                  chatSearchOpen || messageFilter
                    ? 'text-[#1565C0] bg-[#E3F2FD]'
                    : 'text-[#8C8C8C] md:hover:text-[#1565C0] md:hover:bg-[#E3F2FD]'
                }`}
                aria-label="Search in conversation"
              >
                <Search size={16} />
              </button>
            </NavTooltip>
            <NavTooltip
              label="Share"
              description="Copy or share this chat"
              side="bottom"
            >
              <button
                type="button"
                onClick={handleShare}
                disabled={!conversation}
                className="flex min-h-[40px] min-w-[40px] sm:min-h-[44px] sm:min-w-[44px] items-center justify-center rounded-lg p-2 text-[#8C8C8C] active:bg-[#E3F2FD] disabled:opacity-40 md:hover:text-[#1565C0] md:hover:bg-[#E3F2FD]"
                aria-label="Share conversation"
              >
                <Share2 size={16} />
              </button>
            </NavTooltip>
            <NavTooltip
              label="Delete chat"
              description="Remove this conversation permanently"
              side="bottom"
            >
              <button
                type="button"
                onClick={onDeleteConversation}
                disabled={!conversation}
                className="flex min-h-[40px] min-w-[40px] sm:min-h-[44px] sm:min-w-[44px] items-center justify-center rounded-lg p-2 text-[#8C8C8C] active:bg-red-50 active:text-red-500 disabled:opacity-40 md:hover:text-red-500 md:hover:bg-red-50"
                aria-label="Delete conversation"
              >
                <Trash2 size={16} />
              </button>
            </NavTooltip>

          <DropdownMenu.Root>
            <NavTooltip label="More options" description="Rename, clear search, delete">
              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  className="flex min-h-[40px] min-w-[40px] sm:min-h-[44px] sm:min-w-[44px] items-center justify-center rounded-lg p-2 text-[#8C8C8C] active:bg-[#F5F5F5] md:hover:text-[#1A1A1A] md:hover:bg-[#F5F5F5]"
                  aria-label="More options"
                >
                  <MoreVertical size={16} />
                </button>
              </DropdownMenu.Trigger>
            </NavTooltip>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                className="min-w-[180px] bg-white rounded-lg border border-gray-200 shadow-lg py-1 z-50"
                sideOffset={6}
                align="end"
              >
                <DropdownMenu.Item
                  className="px-3 py-2 text-sm text-gray-700 outline-none cursor-pointer hover:bg-gray-50 data-[highlighted]:bg-gray-50"
                  onSelect={() => {
                    setMessageFilter('')
                    setChatSearchQuery('')
                  }}
                >
                  Clear message search
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="px-3 py-2 text-sm text-gray-700 outline-none cursor-pointer hover:bg-gray-50 data-[highlighted]:bg-gray-50"
                  onSelect={startRename}
                >
                  Rename conversation
                </DropdownMenu.Item>
                <DropdownMenu.Separator className="h-px bg-gray-100 my-1" />
                <DropdownMenu.Item
                  className="px-3 py-2 text-sm text-red-600 outline-none cursor-pointer hover:bg-red-50 data-[highlighted]:bg-red-50"
                  onSelect={onDeleteConversation}
                >
                  Delete conversation
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
          </div>
        </div>
      </header>
      )}

      {/* In-chat search bar */}
      {!embedded && chatSearchOpen && (
        <div className="shrink-0 px-4 py-2 border-b border-[#F0F0F0] bg-[#FAFAFA] flex gap-2">
          <input
            value={chatSearchQuery}
            onChange={(e) => setChatSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyChatSearch()}
            placeholder="Search messages…"
            className="flex-1 text-sm rounded-lg border border-[#F0F0F0] px-3 py-1.5 outline-none focus:ring-2 focus:ring-[#2979FF]/30"
          />
          <button
            type="button"
            onClick={applyChatSearch}
            className="px-3 py-1.5 text-sm font-medium text-white bg-[#2979FF] rounded-lg hover:bg-[#1565C0]"
          >
            Find
          </button>
          <button
            type="button"
            onClick={() => {
              setChatSearchOpen(false)
              setChatSearchQuery('')
              setMessageFilter('')
            }}
            className="p-1.5 text-[#8C8C8C] hover:text-[#1A1A1A]"
            aria-label="Close search"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {!embedded && messageFilter && (
        <p className="shrink-0 px-4 py-1.5 text-xs text-[#1565C0] bg-[#E3F2FD] border-b border-[#F0F0F0]">
          Showing messages matching &ldquo;{messageFilter}&rdquo;
          <button
            type="button"
            className="ml-2 underline"
            onClick={() => setMessageFilter('')}
          >
            Clear
          </button>
        </p>
      )}

      {rateLimitSeconds > 0 && (
        <RateLimitBanner
          retryAfterSeconds={rateLimitSeconds}
          onExpired={onRateLimitExpired}
        />
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto touch-scroll bg-white px-4 py-4 md:px-5 md:py-5">
        {showWelcome && filteredMessages.length === 0 && !messageFilter && (
          <div
            className={`bubble-enter group flex flex-col ${
              mobileLayout ? 'max-w-[85%]' : 'max-w-[85%] lg:max-w-[70%]'
            }`}
          >
            <div className="flex gap-2 items-end">
              <RemiAvatar2D size={24} className="mb-0.5 shrink-0" />
              <div className="bg-[#F5F5F5] rounded-[18px] px-3.5 py-2.5 text-sm text-[#1A1A1A]">
                Hi! I&apos;m Remi. How can I help you today?
              </div>
            </div>
          </div>
        )}

        {filteredMessages.map((m, idx) => {
          const isUser = m.role === 'user'
          const fb = feedback[m.id]
          const prev = filteredMessages[idx - 1]
          const sameSender = prev && prev.role === m.role
          const showDivider =
            !prev || dayKey(prev.created_at) !== dayKey(m.created_at)

          return (
            <div key={m.id}>
              {showDivider && <DateDivider label={formatDateDivider(m.created_at)} />}
              <div
                className={`message-row group flex flex-col ${
                  mobileLayout ? 'max-w-[85%]' : 'max-w-[85%] lg:max-w-[70%]'
                } ${isUser ? 'ml-auto items-end' : 'items-start'} ${
                  sameSender && !showDivider ? 'mt-1' : 'mt-3'
                }`}
              >
                <div
                  className={`bubble-enter flex gap-2 items-end w-full ${
                    isUser ? 'flex-row-reverse' : ''
                  }`}
                >
                  {!isUser && <RemiAvatar2D size={24} className="mb-0.5 shrink-0" />}
                  <div
                    className={`px-3.5 py-2.5 rounded-[18px] text-sm leading-relaxed ${
                      isUser
                        ? 'bg-[#1A1A1A] text-white'
                        : 'bg-[#F5F5F5] text-[#1A1A1A]'
                    }`}
                  >
                    {isUser ? m.content : <AssistantMarkdown content={m.content} />}
                    {!isUser && m.has_pdf && m.pdf_content && (
                      <button
                        type="button"
                        onClick={() =>
                          void generatePDFFromContent(
                            m.pdf_content!,
                            m.pdf_filename || 'remi-generated.pdf',
                          )
                        }
                        className="mt-2 flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium underline-offset-2 hover:underline"
                      >
                        <Download size={12} />
                        Download PDF again
                      </button>
                    )}
                  </div>
                </div>

                <span
                  className={`mt-1 text-[10px] text-[#ACACAC] tabular-nums opacity-0 group-hover:opacity-100 transition-opacity ${
                    isUser ? '' : 'ml-8'
                  }`}
                >
                  {formatMessageTime(m.created_at)}
                </span>

                {isUser && (
                  <div className="self-end opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    <NavTooltip label="Edit message" description="Change your message and get a new reply">
                      <button
                        type="button"
                        onClick={() => openEditForMessage(m)}
                        className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-md text-[#8C8C8C] hover:text-[#1565C0] hover:bg-[#E3F2FD]"
                        aria-label="Edit message"
                      >
                        <Pencil size={14} />
                      </button>
                    </NavTooltip>
                  </div>
                )}

                {!isUser && (
                  <div className="ml-8 flex items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    <NavTooltip label="Copy" description="Copy reply to clipboard">
                      <button
                        type="button"
                        onClick={() => handleCopy(m)}
                        className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-md text-[#8C8C8C] hover:text-[#1A1A1A] hover:bg-[#F5F5F5]"
                        aria-label="Copy message"
                      >
                        {copiedId === m.id ? (
                          <Check size={14} className="text-[#22C55E]" />
                        ) : (
                          <Copy size={14} />
                        )}
                      </button>
                    </NavTooltip>
                    <NavTooltip label="Helpful" description="Mark this answer as useful">
                      <button
                        type="button"
                        onClick={() =>
                          setFeedback((prev) => ({ ...prev, [m.id]: 'up' }))
                        }
                        className={`flex min-h-[36px] min-w-[36px] items-center justify-center rounded-md hover:bg-[#F5F5F5] ${
                          fb === 'up'
                            ? 'text-[#1565C0] bg-[#E3F2FD]'
                            : 'text-[#8C8C8C] hover:text-[#1A1A1A]'
                        }`}
                        aria-label="Helpful"
                      >
                        <ThumbsUp size={14} />
                      </button>
                    </NavTooltip>
                    <NavTooltip label="Not helpful" description="Flag a poor answer">
                      <button
                        type="button"
                        onClick={() =>
                          setFeedback((prev) => ({ ...prev, [m.id]: 'down' }))
                        }
                        className={`flex min-h-[36px] min-w-[36px] items-center justify-center rounded-md hover:bg-[#F5F5F5] ${
                          fb === 'down'
                            ? 'text-red-500 bg-red-50'
                            : 'text-[#8C8C8C] hover:text-[#1A1A1A]'
                        }`}
                        aria-label="Not helpful"
                      >
                        <ThumbsDown size={14} />
                      </button>
                    </NavTooltip>
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {isTyping && (
          <div className="bubble-enter flex flex-col max-w-[85%] mt-3">
            <div className="flex gap-2 items-end">
              <RemiAvatar2D size={24} className="mb-0.5 shrink-0" />
              <div className="bg-[#F5F5F5] rounded-[18px] px-4 py-3 flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-[#8C8C8C] animate-dotWave"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
            <span className="ml-8 mt-1 text-[11px] text-[#8C8C8C]">
              Remi is typing...
            </span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-[#F0F0F0] bg-white px-3 py-3 md:px-4">
        <div className="flex items-end gap-2">
          {onOpenFileUploadModal ? (
            <NavTooltip
              label="Attach file"
              description="Upload PDF, DOCX, or TXT for document Q&A"
              side="top"
            >
              <button
                type="button"
                onClick={onOpenFileUploadModal}
                className="relative flex h-11 w-11 min-h-[44px] shrink-0 items-center justify-center rounded-lg text-[#ACACAC] active:text-[#2979FF] md:hover:text-[#2979FF]"
                aria-label="Attach file"
              >
                <Paperclip size={18} />
                {uploadedFileCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#2979FF] px-1 text-[9px] font-bold text-white">
                    {uploadedFileCount > 9 ? '9+' : uploadedFileCount}
                  </span>
                )}
              </button>
            </NavTooltip>
          ) : fileInputRef && onFileChange ? (
            <>
              <NavTooltip label="Attach file" description="Upload a document" side="top">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex h-11 w-11 min-h-[44px] shrink-0 items-center justify-center rounded-lg text-[#ACACAC] active:text-[#2979FF] md:hover:text-[#2979FF]"
                  aria-label="Attach file"
                >
                  <Paperclip size={18} />
                </button>
              </NavTooltip>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                onChange={onFileChange}
              />
            </>
          ) : null}
          <textarea
            value={input}
            onChange={(e) => {
              handleInputChange(e.target.value)
              if (mobileLayout) {
                const el = e.target
                el.style.height = 'auto'
                const lineHeight = 22
                const maxLines = 3
                el.style.height = `${Math.min(el.scrollHeight, lineHeight * maxLines)}px`
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                if (canSend) onSend()
              }
            }}
            placeholder="Ask Remi anything..."
            rows={1}
            disabled={!conversation}
            className={`flex-1 resize-none rounded-[12px] border-0 bg-[#F5F5F5] px-3.5 py-2 text-[#1A1A1A] placeholder:text-[#ACACAC] outline-none focus:ring-2 focus:ring-[#2979FF]/30 disabled:opacity-50 ${
              mobileLayout
                ? 'min-h-[44px] max-h-[4.5rem] text-base'
                : 'min-h-[38px] max-h-32 text-sm'
            }`}
          />
          {input.trim().length > 0 ? (
            <NavTooltip label="Send" description="Send message (Enter)" side="top">
              <button
                type="button"
                onClick={onSend}
                disabled={!canSend}
                className="flex h-11 w-11 min-h-[44px] shrink-0 items-center justify-center rounded-full bg-[#2979FF] text-white active:scale-95 disabled:opacity-50 md:hover:bg-[#1565C0]"
                aria-label="Send message"
              >
                <Send size={16} />
              </button>
            </NavTooltip>
          ) : (
            <NavTooltip label="Voice input" description="Coming soon" side="top">
              <button
                type="button"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#ACACAC]"
                aria-label="Voice input"
                disabled
              >
                <Mic size={18} />
              </button>
            </NavTooltip>
          )}
        </div>
        <p
          className={`mt-1.5 text-right text-[10px] tabular-nums ${
            input.length >= MAX_INPUT_LENGTH ? 'text-[#1565C0]' : 'text-[#ACACAC]'
          }`}
        >
          {input.length}/{MAX_INPUT_LENGTH}
        </p>
      </div>
    </Wrapper>

    {/* Message edit modal (overlay) */}
    {editTarget && conversation?.id && (
      <MessageEditModal
        open={editOpen}
        conversationId={conversation.id}
        userMessage={editTarget}
        onClose={closeEdit}
        onReplaceEditedMessage={(userMessageId, editedContent, newAssistant) =>
          onReplaceEditedMessage?.(userMessageId, editedContent, newAssistant)
        }
      />
    )}
    </>
  )
}
