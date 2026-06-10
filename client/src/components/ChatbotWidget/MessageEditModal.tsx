import { useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw, RotateCw, X, Send } from 'lucide-react'
import type { Message } from '../../types'
import { sendMessage } from '../../api/chat'
import { generatePDFFromContent } from '../../utils/pdfGenerator'

const MAX_INPUT_LENGTH = 2000

export interface MessageEditModalProps {
  open: boolean
  conversationId: string
  userMessage: Message
  onClose: () => void
  onReplaceEditedMessage: (userMessageId: string, editedContent: string, newAssistant: Message) => void
}

export default function MessageEditModal({
  open,
  conversationId,
  userMessage,
  onClose,
  onReplaceEditedMessage,
}: MessageEditModalProps) {
  const [text, setText] = useState(userMessage.content)
  const [history, setHistory] = useState<string[]>([userMessage.content])
  const [historyIndex, setHistoryIndex] = useState(0)
  const [sending, setSending] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!open) return
    const initial = userMessage.content
    setText(initial)
    setHistory([initial])
    setHistoryIndex(0)
    setSending(false)
    window.setTimeout(() => {
      textareaRef.current?.focus()
      textareaRef.current?.select()
    }, 0)
  }, [open, userMessage.id, userMessage.content])

  const canUndo = historyIndex > 0
  const canRedo = historyIndex < history.length - 1

  const counterText = useMemo(() => `${text.length} / ${MAX_INPUT_LENGTH}`, [text.length])

  const applyText = (next: string) => {
    const trimmed = next.slice(0, MAX_INPUT_LENGTH)
    setText(trimmed)
    setHistory((prev) => {
      if (prev[historyIndex] === trimmed) return prev
      const truncated = prev.slice(0, historyIndex + 1)
      return [...truncated, trimmed]
    })
    setHistoryIndex((i) => i + 1)
  }

  const handleUndo = () => {
    if (!canUndo) return
    const nextIndex = historyIndex - 1
    setHistoryIndex(nextIndex)
    setText(history[nextIndex])
  }

  const handleRedo = () => {
    if (!canRedo) return
    const nextIndex = historyIndex + 1
    setHistoryIndex(nextIndex)
    setText(history[nextIndex])
  }

  const handleSend = async () => {
    if (sending) return
    const edited = text.trim()
    if (!edited || !conversationId) return
    setSending(true)
    try {
      const assistant = await sendMessage(conversationId, edited)
      if (assistant.has_pdf && assistant.pdf_content) {
        void generatePDFFromContent(
          assistant.pdf_content,
          assistant.pdf_filename || 'remi-generated.pdf',
        )
      }
      onReplaceEditedMessage(userMessage.id, edited, assistant)
      onClose()
    } finally {
      setSending(false)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[70] flex max-md:items-end md:items-center md:justify-center md:bg-black/40"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="max-h-[90vh] w-full overflow-hidden bg-white shadow-2xl max-md:animate-slideInUp max-md:rounded-t-2xl md:max-w-2xl md:rounded-xl">
        <div className="md:hidden mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-gray-200" />
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <div className="text-sm font-semibold text-gray-800">Edit message</div>
          <button
            type="button"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md p-1.5 text-gray-400 active:bg-gray-100 md:hover:bg-gray-100 md:hover:text-gray-700"
            onClick={onClose}
            aria-label="Close"
            disabled={sending}
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => applyText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault()
                handleSend()
              }
              if (e.key === 'Escape') onClose()
            }}
            className="min-h-[140px] w-full max-h-[320px] resize-none rounded-lg border border-gray-200 px-3 py-2 text-base outline-none focus:border-[#2979FF] md:text-sm"
          />
        </div>

        <div className="px-4 pb-4 pb-safe max-md:pb-6">
          <div className="flex flex-col gap-3 max-md:gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="text-xs text-gray-500 tabular-nums">{counterText}</div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={!canUndo || sending}
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md p-1.5 text-gray-400 active:bg-gray-100 disabled:opacity-40 md:hover:bg-gray-100"
                  aria-label="Undo"
                >
                  <RotateCcw size={18} />
                </button>
                <button
                  type="button"
                  onClick={handleRedo}
                  disabled={!canRedo || sending}
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md p-1.5 text-gray-400 active:bg-gray-100 disabled:opacity-40 md:hover:bg-gray-100"
                  aria-label="Redo"
                >
                  <RotateCw size={18} />
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={sending}
                className="min-h-[44px] flex-1 rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-700 active:bg-gray-50 disabled:opacity-40 md:flex-none md:hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSend}
                disabled={sending || !conversationId || !text.trim()}
                className="min-h-[44px] flex-1 rounded-lg bg-[#2979FF] px-3 py-2.5 text-sm text-white active:opacity-90 disabled:opacity-40 md:flex-none md:hover:bg-[#1565C0] flex items-center justify-center gap-1.5"
              >
                <Send size={16} />
                {sending ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
