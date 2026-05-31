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
    : 'flex-1 flex flex-col min-w-0 border-r border-[#F0F0F0] bg-white'

  return (<>
    <Wrapper className={wrapperClass}>
      {/* Conversation header */}
      {!embedded && (
      <header className="shrink-0 flex items-center gap-2 px-4 py-3 border-b border-[#F0F0F0]">
        <div className="flex-1 min-w-0 flex items-center gap-1.5">
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
                className="flex-1 min-w-0 text-sm font-semibold text-[#1A1A1A] border border-[#F59E0B]/40 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-[#F59E0B]/40"
                maxLength={120}
              />
              <button
                type="button"
                onClick={commitRename}
                className="p-1 rounded-md text-[#D97706] hover:bg-[#FFFBF0]"
                aria-label="Save title"
              >
                <Check size={16} />
              </button>
              <button
                type="button"
                onClick={cancelRename}
                className="p-1 rounded-md text-[#8C8C8C] hover:bg-[#F5F5F5]"
                aria-label="Cancel rename"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <>
              <h2 className="text-sm font-semibold text-[#1A1A1A] truncate">
                {conversation?.title ?? 'New Chat'}
              </h2>
              <button
                type="button"
                onClick={startRename}
                disabled={!conversation}
                className="p-1 rounded-md text-[#8C8C8C] hover:text-[#D97706] hover:bg-[#FFFBF0] disabled:opacity-40 shrink-0"
                aria-label="Rename conversation"
              >
                <Pencil size={14} />
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={handleSearchToggle}
            className={`p-2 rounded-lg transition-colors ${
              chatSearchOpen || messageFilter
                ? 'text-[#D97706] bg-[#FFFBF0]'
                : 'text-[#8C8C8C] hover:text-[#D97706] hover:bg-[#FFFBF0]'
            }`}
            aria-label="Search in conversation"
          >
            <Search size={16} />
          </button>
          <button
            type="button"
            onClick={handleShare}
            disabled={!conversation}
            className="p-2 rounded-lg text-[#8C8C8C] hover:text-[#D97706] hover:bg-[#FFFBF0] disabled:opacity-40"
            aria-label="Share conversation"
          >
            <Share2 size={16} />
          </button>
          <button
            type="button"
            onClick={onDeleteConversation}
            disabled={!conversation}
            className="p-2 rounded-lg text-[#8C8C8C] hover:text-red-500 hover:bg-red-50 disabled:opacity-40"
            aria-label="Delete conversation"
          >
            <Trash2 size={16} />
          </button>

          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                className="p-2 rounded-lg text-[#8C8C8C] hover:text-[#1A1A1A] hover:bg-[#F5F5F5]"
                aria-label="More options"
              >
                <MoreVertical size={16} />
              </button>
            </DropdownMenu.Trigger>
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
            className="flex-1 text-sm rounded-lg border border-[#F0F0F0] px-3 py-1.5 outline-none focus:ring-2 focus:ring-[#F59E0B]/30"
          />
          <button
            type="button"
            onClick={applyChatSearch}
            className="px-3 py-1.5 text-sm font-medium text-white bg-[#F59E0B] rounded-lg hover:bg-[#D97706]"
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
        <p className="shrink-0 px-4 py-1.5 text-xs text-[#D97706] bg-[#FFFBF0] border-b border-[#F0F0F0]">
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

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-5 bg-white">
        {showWelcome && filteredMessages.length === 0 && !messageFilter && (
          <div className="bubble-enter group flex flex-col max-w-[85%]">
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
                className={`message-row flex flex-col max-w-[85%] ${
                  isUser ? 'ml-auto items-end' : 'items-start'
                } ${sameSender && !showDivider ? 'mt-1' : 'mt-3'} group`}
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
                        className="mt-2 flex items-center gap-1.5 text-xs text-amber-600 hover:text-amber-700 font-medium underline-offset-2 hover:underline"
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
                  <div className="self-end opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => openEditForMessage(m)}
                      className="p-1 rounded-md text-[#8C8C8C] hover:text-[#D97706] hover:bg-[#FFFBF0]"
                      aria-label="Edit message"
                    >
                      <Pencil size={14} />
                    </button>
                  </div>
                )}

                {!isUser && (
                  <div className="ml-8 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => handleCopy(m)}
                      className="p-1.5 rounded-md text-[#8C8C8C] hover:text-[#1A1A1A] hover:bg-[#F5F5F5]"
                      aria-label="Copy message"
                    >
                      {copiedId === m.id ? (
                        <Check size={14} className="text-[#22C55E]" />
                      ) : (
                        <Copy size={14} />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setFeedback((prev) => ({ ...prev, [m.id]: 'up' }))
                      }
                      className={`p-1.5 rounded-md hover:bg-[#F5F5F5] ${
                        fb === 'up'
                          ? 'text-[#D97706] bg-[#FFFBF0]'
                          : 'text-[#8C8C8C] hover:text-[#1A1A1A]'
                      }`}
                      aria-label="Helpful"
                    >
                      <ThumbsUp size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setFeedback((prev) => ({ ...prev, [m.id]: 'down' }))
                      }
                      className={`p-1.5 rounded-md hover:bg-[#F5F5F5] ${
                        fb === 'down'
                          ? 'text-red-500 bg-red-50'
                          : 'text-[#8C8C8C] hover:text-[#1A1A1A]'
                      }`}
                      aria-label="Not helpful"
                    >
                      <ThumbsDown size={14} />
                    </button>
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
      <div className="shrink-0 border-t border-[#F0F0F0] bg-white px-4 py-3">
        <div className="flex items-end gap-2">
          {onOpenFileUploadModal ? (
            <button
              type="button"
              onClick={onOpenFileUploadModal}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-[#ACACAC] hover:text-[#F59E0B] transition-colors shrink-0"
              aria-label="Attach file"
            >
              <Paperclip size={18} />
            </button>
          ) : fileInputRef && onFileChange ? (
            <>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-[#ACACAC] hover:text-[#F59E0B] transition-colors shrink-0"
                aria-label="Attach file"
              >
                <Paperclip size={18} />
              </button>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                onChange={onFileChange}
                accept=".pdf,.txt,.docx,.xlsx,.md"
              />
            </>
          ) : null}
          <textarea
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                if (canSend) onSend()
              }
            }}
            placeholder="Ask Remi anything..."
            rows={1}
            disabled={!conversation}
            className="flex-1 resize-none rounded-[12px] border-0 bg-[#F5F5F5] px-3.5 py-2 text-sm text-[#1A1A1A] placeholder:text-[#ACACAC] outline-none focus:ring-2 focus:ring-[#F59E0B]/30 min-h-[38px] max-h-32 disabled:opacity-50"
          />
          {input.trim().length > 0 ? (
            <button
              type="button"
              onClick={onSend}
              disabled={!canSend}
              className="w-9 h-9 rounded-full bg-[#F59E0B] text-white flex items-center justify-center hover:bg-[#D97706] active:scale-95 transition-all disabled:opacity-50 shrink-0"
              aria-label="Send message"
            >
              <Send size={16} />
            </button>
          ) : (
            <button
              type="button"
              className="w-9 h-9 rounded-full flex items-center justify-center text-[#ACACAC] shrink-0"
              aria-label="Voice input"
              disabled
            >
              <Mic size={18} />
            </button>
          )}
        </div>
        <p
          className={`mt-1.5 text-right text-[10px] tabular-nums ${
            input.length >= MAX_INPUT_LENGTH ? 'text-[#D97706]' : 'text-[#ACACAC]'
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
