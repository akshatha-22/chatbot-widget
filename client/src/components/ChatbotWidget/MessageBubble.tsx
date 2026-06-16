import { ExternalLink } from 'lucide-react'
import AssistantMarkdown from './AssistantMarkdown'
import type { Message } from '../../types'
import type { TMessageSource } from '../../types/chat'

type MessageBubbleProps = {
  message: Message
  isUser: boolean
  onDownloadPdf?: () => void
}

const SOURCE_CONFIG: Record<
  TMessageSource,
  { icon: string; label: string; color: string }
> = {
  document: {
    icon: '📄',
    label: 'From your document',
    color: '#1565c0',
  },
  both: {
    icon: '📄🌐',
    label: 'From your document + web',
    color: '#2979FF',
  },
  web: {
    icon: '🌐',
    label: 'From the web',
    color: '#2979FF',
  },
  none: {
    icon: '⚠️',
    label: 'Not found in document or web',
    color: '#f59e0b',
  },
}

function normalizeSource(source?: string | null): TMessageSource | null {
  if (source == null) return null
  if (source === 'catalog') return 'document'
  if (source in SOURCE_CONFIG) return source as TMessageSource
  return null
}

export default function MessageBubble({
  message,
  isUser,
  onDownloadPdf,
}: MessageBubbleProps) {
  if (isUser) {
    return <>{message.content}</>
  }

  const source = normalizeSource(message.source)
  const links = message.links ?? []

  return (
    <>
      <AssistantMarkdown content={message.content} />
      {message.has_pdf && message.pdf_content && onDownloadPdf && (
        <button
          type="button"
          onClick={onDownloadPdf}
          className="mt-2 flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium underline-offset-2 hover:underline"
        >
          Download PDF again
        </button>
      )}

      {source != null && (
        <>
          <div
            className="remi-source-badge"
            style={{ color: SOURCE_CONFIG[source].color }}
          >
            <span>{SOURCE_CONFIG[source].icon}</span>
            <span>{SOURCE_CONFIG[source].label}</span>
          </div>

          {(source === 'web' || source === 'both') && links.length > 0 && (
            <div className="remi-external-links">
              <p className="remi-links-header">Sources</p>
              <ul className="remi-links-list">
                {links.map((link, index) => (
                  <li key={`${link.url}-${index}`}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="remi-link-item"
                    >
                      <ExternalLink size={11} />
                      <span>{link.title}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </>
  )
}
