import { useState, useEffect, useRef } from 'react'
import { Maximize2, Minus, X, Paperclip, Send, Mic, LogOut, Download } from 'lucide-react'
import { streamSendMessage } from './streamSend'
import type { Message, Conversation, UploadedFile } from '../../types'
import { generatePDFFromContent } from '../../utils/pdfGenerator'
import FileUploadModal from './FileUploadModal'
import AssistantMarkdown from './AssistantMarkdown'
import RemiAvatar2D from './RemiAvatar2D'

export type CompactWidgetProps = {
  conversation: Conversation | null
  messages: Message[]
  files: UploadedFile[]
  starredIds: Set<string>
  onMessagesChange: React.Dispatch<React.SetStateAction<Message[]>>
  onFilesChange: React.Dispatch<React.SetStateAction<UploadedFile[]>>
  onToggleStar: (id: string) => void
  onRefreshConversations: () => Promise<unknown>
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
  onMessagesChange,
  onFilesChange,
  onRefreshConversations,
  onExpand,
  onClose,
  onLogout,
}: CompactWidgetProps) {
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const isSendingRef = useRef(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const [fileUploadOpen, setFileUploadOpen] = useState(false)

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
      onMessagesChange,
      onRefreshConversations,
      setIsTyping,
    })
  }

  const handleOpenFileUpload = () => {
    if (!conversation) return
    setFileUploadOpen(true)
  }

  const hasText = input.trim().length > 0

  return (
    <div className="fixed bottom-[100px] right-[20px] w-[350px] rounded-2xl border border-[#F0F0F0] bg-white shadow-[0_12px_40px_rgba(0,0,0,0.12)] flex flex-col overflow-hidden z-50 animate-widgetIn origin-bottom-right">
      {/* Header */}
      <header className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-[#F0F0F0] bg-gradient-to-b from-white to-[#FAFAFA]">
        <div className="flex items-center gap-2.5">
          <RemiAvatar2D size={28} className="shrink-0" />
          <div className="leading-tight">
            <p className="text-sm font-semibold text-[#1A1A1A]">Remi</p>
            <p className="flex items-center gap-1 text-[11px] text-[#8C8C8C]">
              <span className="h-2 w-2 rounded-full bg-[#22C55E]" />
              Online
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="p-1.5 rounded-lg text-[#8C8C8C] hover:bg-[#F5F5F5] hover:text-[#1A1A1A] transition-colors"
              aria-label="Sign out"
            >
              <LogOut size={16} />
            </button>
          )}
          <button
            type="button"
            onClick={onExpand}
            className="p-1.5 rounded-lg text-[#8C8C8C] hover:bg-[#F5F5F5] hover:text-[#1A1A1A] transition-colors"
            aria-label="Expand"
          >
            <Maximize2 size={16} />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8C8C8C] hover:bg-[#F5F5F5] hover:text-[#1A1A1A] transition-colors"
            aria-label="Minimize"
          >
            <Minus size={16} />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8C8C8C] hover:bg-[#F5F5F5] hover:text-[#1A1A1A] transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
      </header>

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
          <button
            type="button"
            onClick={handleOpenFileUpload}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-[#ACACAC] hover:text-[#F59E0B] transition-colors shrink-0"
            aria-label="Attach file"
          >
            <Paperclip size={18} />
          </button>
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
            className="flex-1 resize-none rounded-[12px] border-0 bg-[#F5F5F5] px-3.5 py-2 text-sm text-[#1A1A1A] placeholder:text-[#ACACAC] outline-none focus:ring-2 focus:ring-[#F59E0B]/30 min-h-[38px] max-h-28"
          />
          {hasText ? (
            <button
              type="button"
              onClick={handleSend}
              disabled={isTyping}
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
      </div>

      {fileUploadOpen && conversation && (
        <FileUploadModal
          open={fileUploadOpen}
          conversationId={conversation.id}
          onClose={() => setFileUploadOpen(false)}
          onUploaded={(uploaded) => {
            onFilesChange((prev) =>
              prev.some((f) => f.id === uploaded.id) ? prev : [...prev, uploaded],
            )
          }}
        />
      )}
    </div>
  )
}
