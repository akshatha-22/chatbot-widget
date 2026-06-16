import { useState, useEffect, useRef } from 'react'
import { Maximize2, Minus, X, Paperclip, Send, Mic, LogOut } from 'lucide-react'
import { streamSendMessage } from './streamSend'
import { listFiles } from '../../api/files'
import type { Message, Conversation, UploadedFile } from '../../types'
import { generatePDFFromContent } from '../../utils/pdfGenerator'
import FileUploadModal from './FileUploadModal'
import MessageBubble from './MessageBubble'
import RemiAvatar2D from './RemiAvatar2D'
import { RateLimitBanner } from './RateLimitBanner'
import { NavTooltip, WidgetTooltipProvider } from './NavTooltip'

export type CompactWidgetProps = {
  conversation: Conversation | null
  messages: Message[]
  files: UploadedFile[]
  starredIds: Set<string>
  onMessagesChange: React.Dispatch<React.SetStateAction<Message[]>>
  onFilesChange: React.Dispatch<React.SetStateAction<UploadedFile[]>>
  onToggleStar: (id: string) => void
  onRefreshConversations: () => Promise<unknown>
  streamControllerRef?: React.MutableRefObject<AbortController | null>
  onExpand: () => void
  onClose: () => void
  onLogout?: () => void
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  } catch {
    return ''
  }
}

export default function CompactWidget({
  conversation,
  messages,
  files,
  onMessagesChange,
  onFilesChange,
  onRefreshConversations,
  streamControllerRef,
  onExpand,
  onClose,
  onLogout,
}: CompactWidgetProps) {
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const isSendingRef = useRef(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const [fileUploadOpen, setFileUploadOpen] = useState(false)
  const [rateLimitSeconds, setRateLimitSeconds] = useState(0)

  useEffect(() => {
    setIsTyping(false)
    isSendingRef.current = false
  }, [conversation?.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

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
  }

  const handleOpenFileUpload = () => {
    if (!conversation) return
    setFileUploadOpen(true)
  }

  const hasText = input.trim().length > 0

  return (
    <WidgetTooltipProvider>
    <div className="fixed z-50 flex flex-col overflow-hidden border border-[#F0F0F0] bg-white shadow-[0_12px_40px_rgba(0,0,0,0.12)] animate-widgetIn max-md:inset-x-0 max-md:bottom-0 max-md:top-auto max-md:max-h-[min(92vh,640px)] max-md:rounded-t-2xl max-md:rounded-b-none md:bottom-[100px] md:right-[20px] md:w-[350px] md:max-w-[calc(100vw-2rem)] md:rounded-2xl md:origin-bottom-right">
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-[#F0F0F0] bg-gradient-to-b from-white to-[#FAFAFA] px-3 py-2.5 md:px-4 md:py-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <RemiAvatar2D size={28} className="shrink-0" />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-semibold text-[#1A1A1A]">Remi</p>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[#8C8C8C]">
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 shrink-0 rounded-full bg-[#22C55E]" />
                Online
              </span>
              {conversation && (
                <button
                  type="button"
                  onClick={handleOpenFileUpload}
                  className="inline-flex max-w-full items-center gap-1 rounded-full bg-[#E3F2FD] px-1.5 py-0.5 text-[10px] font-medium text-[#1565C0] hover:bg-[#BBDEFB]"
                >
                  <Paperclip size={10} />
                  {files.length === 0
                    ? 'No files'
                    : `${files.length} file${files.length === 1 ? '' : 's'}`}
                </button>
              )}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {onLogout && (
            <NavTooltip label="Sign out" description="Log out of your account" side="bottom">
              <button
                type="button"
                onClick={onLogout}
                className="flex h-10 w-10 items-center justify-center rounded-lg text-[#8C8C8C] active:bg-[#F5F5F5] md:p-1.5 md:hover:bg-[#F5F5F5] md:hover:text-[#1A1A1A]"
                aria-label="Sign out"
              >
                <LogOut size={16} />
              </button>
            </NavTooltip>
          )}
          <NavTooltip
            label="Expand"
            description="Open full-screen chat with files and history"
            side="bottom"
          >
            <button
              type="button"
              onClick={onExpand}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-[#8C8C8C] active:bg-[#F5F5F5] md:p-1.5 md:hover:bg-[#F5F5F5] md:hover:text-[#1A1A1A]"
              aria-label="Expand widget"
            >
              <Maximize2 size={16} />
            </button>
          </NavTooltip>
          <NavTooltip label="Minimize" description="Hide chat to the launcher" side="bottom">
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-[#8C8C8C] active:bg-[#F5F5F5] md:p-1.5 md:hover:bg-[#F5F5F5] md:hover:text-[#1A1A1A]"
              aria-label="Minimize"
            >
              <Minus size={16} />
            </button>
          </NavTooltip>
          <NavTooltip label="Close" description="Dismiss the widget" side="bottom">
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-[#8C8C8C] active:bg-[#F5F5F5] md:p-1.5 md:hover:bg-[#F5F5F5] md:hover:text-[#1A1A1A]"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </NavTooltip>
        </div>
      </header>

      {rateLimitSeconds > 0 && (
        <RateLimitBanner
          retryAfterSeconds={rateLimitSeconds}
          onExpired={() => setRateLimitSeconds(0)}
        />
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-5 min-h-[260px] max-h-[300px] bg-white">
        {messages.length === 0 && (
          <div className="bubble-enter flex gap-2 items-end">
            <RemiAvatar2D size={24} className="mb-0.5 shrink-0" />
            <div className="bg-[#F5F5F5] rounded-[18px] px-3.5 py-2.5 text-sm text-[#1A1A1A]">
              Hi! I&apos;m Remi. How can I help you today?
            </div>
          </div>
        )}
        {messages.map((m, i) => {
          const isUser = m.role === 'user'
          const prev = messages[i - 1]
          const sameSender = prev && prev.role === m.role
          return (
            <div
              key={m.id}
              className={`bubble-enter group flex gap-2 items-end ${
                isUser ? 'flex-row-reverse' : ''
              } ${sameSender ? 'mt-1' : 'mt-3'}`}
            >
              {!isUser && <RemiAvatar2D size={24} className="mb-0.5 shrink-0" />}
              <div className="flex flex-col max-w-[80%]">
                <div
                  className={`px-3.5 py-2.5 rounded-[18px] text-sm leading-relaxed ${
                    isUser
                      ? 'bg-[#1A1A1A] text-white'
                      : 'bg-[#F5F5F5] text-[#1A1A1A]'
                  }`}
                >
                  {isUser ? (
                    m.content
                  ) : (
                    <MessageBubble
                      message={m}
                      isUser={false}
                      onDownloadPdf={
                        m.has_pdf && m.pdf_content
                          ? () =>
                              void generatePDFFromContent(
                                m.pdf_content!,
                                m.pdf_filename || 'remi-generated.pdf',
                              )
                          : undefined
                      }
                    />
                  )}
                </div>
                <span
                  className={`mt-1 text-[10px] text-[#ACACAC] opacity-0 group-hover:opacity-100 transition-opacity ${
                    isUser ? 'text-right' : ''
                  }`}
                >
                  {formatTime(m.created_at)}
                </span>
              </div>
            </div>
          )
        })}
        {isTyping && (
          <div className="bubble-enter flex gap-2 items-end mt-3">
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
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-[#F0F0F0] bg-white px-4 py-3">
        <div className="flex items-end gap-2">
          <NavTooltip
            label="Attach file"
            description="Upload PDF, DOCX, or TXT"
            side="top"
          >
            <button
              type="button"
              onClick={handleOpenFileUpload}
              className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#ACACAC] transition-colors hover:text-[#2979FF]"
              aria-label="Attach file"
            >
              <Paperclip size={18} />
              {files.length > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#2979FF] px-1 text-[9px] font-bold text-white">
                  {files.length > 9 ? '9+' : files.length}
                </span>
              )}
            </button>
          </NavTooltip>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder="Ask Remi anything..."
            rows={1}
            className="flex-1 resize-none rounded-[12px] border-0 bg-[#F5F5F5] px-3.5 py-2 text-sm text-[#1A1A1A] placeholder:text-[#ACACAC] outline-none focus:ring-2 focus:ring-[#2979FF]/30 min-h-[38px] max-h-28"
          />
          {hasText ? (
            <NavTooltip label="Send" description="Send your message" side="top">
              <button
                type="button"
                onClick={handleSend}
                disabled={isTyping}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2979FF] text-white transition-all hover:bg-[#1565C0] active:scale-95 disabled:opacity-50"
                aria-label="Send message"
              >
                <Send size={16} />
              </button>
            </NavTooltip>
          ) : (
            <NavTooltip label="Voice" description="Coming soon" side="top">
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
      </div>

      {fileUploadOpen && conversation && (
        <FileUploadModal
          open={fileUploadOpen}
          conversationId={conversation.id}
          files={files}
          onClose={() => setFileUploadOpen(false)}
          onUploaded={async (uploaded) => {
            onFilesChange((prev) =>
              prev.some((f) => f.id === uploaded.id) ? prev : [...prev, uploaded],
            )
            try {
              const refreshed = await listFiles(conversation.id)
              onFilesChange(refreshed)
            } catch {
              /* polling will retry */
            }
          }}
        />
      )}
    </div>
    </WidgetTooltipProvider>
  )
}
