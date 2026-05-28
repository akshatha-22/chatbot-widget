import React, { useImperativeHandle, useRef } from 'react'

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void
  accept?: string
  multiple?: boolean
  maxSize?: number // in bytes
}

/**
 * FileUpload Component
 * File input wrapper with validation and preview support
 */
export const FileUpload = React.forwardRef<HTMLInputElement, FileUploadProps>(
  ({
    onFilesSelected,
    accept = '.pdf,.doc,.docx,.txt,.csv,.json',
    multiple = true,
    maxSize = 10 * 1024 * 1024, // 10MB default
  }, ref) => {
    const inputRef = useRef<HTMLInputElement>(null)
    useImperativeHandle(ref, () => inputRef.current as HTMLInputElement)

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || [])
      const validFiles = files.filter((file) => {
        if (maxSize && file.size > maxSize) {
          console.warn(`File ${file.name} exceeds max size of ${maxSize} bytes`)
          return false
        }
        return true
      })
      onFilesSelected(validFiles)
    }

    return (
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleChange}
          className="hidden"
        />
        <button
          className="p-2 hover:bg-gray-100 rounded-md transition-colors"
          onClick={() => inputRef.current?.click()}
        >
          📁 Upload File
        </button>
      </div>
    )
  }
)

FileUpload.displayName = 'FileUpload'
