import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

type AssistantMarkdownProps = {
  content: string
  className?: string
}

/** Renders assistant message content as GitHub-flavored markdown. */
export default function AssistantMarkdown({
  content,
  className = '',
}: AssistantMarkdownProps) {
  return (
    <div
      className={`msg-bubble prose prose-sm max-w-none prose-p:my-1.5 prose-p:first:mt-0 prose-p:last:mb-0 prose-ul:my-1.5 prose-ol:my-1.5 prose-ul:pl-4 prose-ol:pl-4 prose-li:my-0.5 prose-strong:font-semibold prose-strong:text-gray-900 prose-headings:text-gray-900 prose-headings:font-semibold prose-h1:text-base prose-h2:text-sm prose-h3:text-sm prose-h1:mb-1 prose-h2:mb-1 prose-h3:mb-1 prose-h1:mt-2 prose-h2:mt-2 prose-h3:mt-1.5 prose-code:rounded prose-code:bg-gray-200/80 prose-code:px-1 prose-code:py-0.5 prose-code:text-[0.85em] prose-code:font-mono prose-code:before:content-none prose-code:after:content-none prose-pre:my-2 prose-pre:rounded-lg prose-pre:bg-gray-200/80 prose-pre:p-2 prose-pre:text-xs ${className}`}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  )
}
