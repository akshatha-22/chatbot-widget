import { useState, useEffect, useRef } from 'react'
import { Maximize2, X, Paperclip, Pencil, Clipboard, Send } from 'lucide-react'
import { streamMessage } from '../../api/chat'
import type { Message, Conversation, UploadedFile } from '../../types'
import FileUploadModal from './FileUploadModal'
import AssistantMarkdown from './AssistantMarkdown'

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
}

export default function CompactWidget({
  conversation,
  messages,
  onMessagesChange,
  onFilesChange,
  onRefreshConversations,
  onExpand,
  onClose,
}: CompactWidgetProps) {
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const [fileUploadOpen, setFileUploadOpen] = useState(false)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

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
          void onRefreshConversations()
        },
      })
    } catch {
      onMessagesChange((prev) => prev.filter((m) => m.id !== assistantId))
    } finally {
      setIsTyping(false)
    }
  }

  const handleOpenFileUpload = () => {
    if (!conversation) return
    setFileUploadOpen(true)
  }

  return (
    <div className="fixed bottom-[88px] right-5 w-[350px] rounded-2xl border border-gray-200 bg-white shadow-xl flex flex-col overflow-hidden z-50">
      <div className="bg-indigo-500 h-12 flex items-center justify-between px-4 shrink-0">
        <span className="text-white font-semibold text-sm">Remi</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onExpand}
            className="text-white/80 hover:text-white"
          >
            <Maximize2 size={16} />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="text-white/80 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[260px] max-h-[280px]">
        {messages.length === 0 && (
          <div className="flex gap-2 items-end">
            <div className="w-6 h-6 rounded-full bg-yellow-400 shrink-0" />
            <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-3 py-2 text-sm text-gray-800">
              Hi! I&apos;m Remi. How can I help you today?
            </div>
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex gap-2 items-end ${m.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            {m.role === 'assistant' && (
              <div className="w-6 h-6 rounded-full bg-yellow-400 shrink-0" />
            )}
            <div
              className={`px-3 py-2 rounded-2xl text-sm max-w-[80%] ${
                m.role === 'user'
                  ? 'bg-indigo-500 text-white rounded-br-sm'
                  : 'bg-gray-100 text-gray-800 rounded-bl-sm'
              }`}
            >
              {m.role === 'assistant' ? (
                <AssistantMarkdown content={m.content} />
              ) : (
                m.content
              )}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex gap-2 items-end">
            <div className="w-6 h-6 rounded-full bg-yellow-400 shrink-0" />
            <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-gray-100 bg-gray-50 px-3 py-2 flex items-center gap-2">
        <div className="flex gap-1">
          <button
            type="button"
            onClick={handleOpenFileUpload}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-indigo-500 hover:bg-indigo-50"
            aria-label="Upload files"
          >
            <Paperclip size={14} />
          </button>
          <button
            type="button"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-indigo-500 hover:bg-indigo-50"
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-indigo-500 hover:bg-indigo-50"
          >
            <Clipboard size={14} />
          </button>
        </div>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
          placeholder="Type your message…"
          rows={1}
          className="flex-1 resize-none rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-indigo-400 h-[34px]"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={isTyping}
          className="w-[34px] h-[34px] rounded-lg bg-indigo-500 text-white flex items-center justify-center hover:bg-indigo-600 disabled:opacity-50 shrink-0"
        >
          <Send size={14} />
        </button>
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
