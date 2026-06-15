import { ExternalLink } from 'lucide-react'
import AssistantMarkdown from './AssistantMarkdown'
import type { Message } from '../../types'

type MessageBubbleProps = {
  message: Message
  isUser: boolean
  onDownloadPdf?: () => void
}

export default function MessageBubble({
  message,
  isUser,
  onDownloadPdf,
}: MessageBubbleProps) {
  if (isUser) {
    return <>{message.content}</>
  }

  const source = message.source ?? 'catalog'
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

      <div className="remi-source-badge">
        {source === 'catalog' && (
          <span className="remi-badge-catalog">📄 From your catalog</span>
        )}
        {source === 'web' && (
          <span className="remi-badge-web">🌐 From public web — not in your catalog</span>
        )}
        {source === 'none' && (
          <span className="remi-badge-none">⚠️ Not found anywhere</span>
        )}
      </div>

      {source === 'web' && links.length > 0 && (
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
                  <ExternalLink size={11} className="remi-link-icon" />
                  <span>{link.title}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}
