import { useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw, RotateCw, X, Send } from 'lucide-react'
import type { Message } from '../../types'
import { sendMessage } from '../../api/chat'

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
      // Avoid duplicates in history (e.g., multiple events for same value).
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
      onReplaceEditedMessage(userMessage.id, edited, assistant)
      onClose()
    } finally {
      setSending(false)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="text-sm font-semibold text-gray-800">Edit message</div>
          <button
            type="button"
            className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100"
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
            className="w-full min-h-[140px] max-h-[320px] resize-none border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400"
          />
        </div>

        <div className="px-4 pb-4">
          <div className="flex items-center justify-between gap-3">
            {/* Bottom-left: counter + undo/redo */}
            <div className="flex items-center gap-3">
              <div className="text-xs text-gray-500 tabular-nums">{counterText}</div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={!canUndo || sending}
                  className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-40"
                  aria-label="Undo"
                >
                  <RotateCcw size={18} />
                </button>
                <button
                  type="button"
                  onClick={handleRedo}
                  disabled={!canRedo || sending}
                  className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-40"
                  aria-label="Redo"
                >
                  <RotateCw size={18} />
                </button>
              </div>
            </div>

            {/* Bottom-right: cancel + send */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={sending}
                className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSend}
                disabled={sending || !conversationId || !text.trim()}
                className="px-3 py-2 rounded-lg bg-indigo-500 text-sm text-white hover:bg-indigo-600 disabled:opacity-40 flex items-center gap-1.5"
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

