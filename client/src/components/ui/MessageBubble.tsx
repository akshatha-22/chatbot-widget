import React from 'react'

interface MessageBubbleProps {
  message: string
  author: 'user' | 'assistant'
  timestamp?: Date
  files?: Array<{ name: string; size: number }>
}

/**
 * MessageBubble Component
 * Displays individual chat messages with optional files
 */
export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  author,
  timestamp,
  files,
}) => {
  return (
    <div
      className={`flex mb-4 ${author === 'user' ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`
          max-w-xs px-4 py-2 rounded-lg
          ${author === 'user'
            ? 'bg-blue-600 text-white rounded-br-none'
            : 'bg-gray-200 text-gray-900 rounded-bl-none'
          }
        `}
      >
        <p className="text-sm">{message}</p>
        {timestamp && (
          <span className={`text-xs mt-1 block ${
            author === 'user' ? 'text-blue-100' : 'text-gray-600'
          }`}>
            {timestamp.toLocaleTimeString()}
          </span>
        )}
        {files && files.length > 0 && (
          <div className="mt-2 space-y-1">
            {files.map((file) => (
              <div
                key={file.name}
                className={`text-xs ${
                  author === 'user' ? 'text-blue-100' : 'text-gray-700'
                }`}
              >
                📎 {file.name} ({(file.size / 1024).toFixed(2)} KB)
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
