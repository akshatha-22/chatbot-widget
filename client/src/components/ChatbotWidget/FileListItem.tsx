import { useState } from 'react'
import { Check, FileText, Trash2, X } from 'lucide-react'
import type { UploadedFile } from '../../types'

const FILE_TYPE_COLORS: Record<string, string> = {
  pdf: '#EF4444',
  doc: '#3B82F6',
  docx: '#3B82F6',
  xls: '#22C55E',
  xlsx: '#22C55E',
  csv: '#22C55E',
  txt: '#8C8C8C',
  md: '#8C8C8C',
}

function fileIconColor(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  return FILE_TYPE_COLORS[ext] ?? '#8C8C8C'
}

type FileListItemProps = {
  file: UploadedFile
  onDelete: (fileId: string) => Promise<void>
  compact?: boolean
}

export default function FileListItem({
  file,
  onDelete,
  compact = false,
}: FileListItemProps) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const processed = file.status === 'processed'
  const failed = file.status === 'failed'
  const failureDetail = file.processing_error?.trim()

  const handleConfirmDelete = async () => {
    setDeleting(true)
    try {
      await onDelete(file.id)
    } finally {
      setDeleting(false)
      setConfirming(false)
    }
  }

  return (
    <div
      className={`flex min-h-[44px] items-center gap-2.5 rounded-[8px] border border-[#F0F0F0] bg-white px-3 active:bg-[#FAFAFA] md:transition-shadow md:hover:shadow-[0_2px_10px_rgba(0,0,0,0.06)] ${
        compact ? 'py-2.5' : 'py-3'
      }`}
    >
      <FileText
        size={compact ? 16 : 20}
        className="shrink-0"
        style={{ color: fileIconColor(file.filename) }}
      />
      <div className="min-w-0 flex-1">
        <p
          className={`truncate font-medium text-[#1A1A1A] ${
            compact ? 'text-xs' : 'text-sm'
          }`}
        >
          {file.filename}
        </p>
        {processed ? (
          <p
            className={`flex items-center gap-1 text-[#22C55E] ${
              compact ? 'text-[11px]' : 'text-xs'
            }`}
          >
            <Check size={compact ? 11 : 14} /> Ready
          </p>
        ) : failed ? (
          <div>
            <p
              className={`flex items-center gap-1 text-red-500 ${
                compact ? 'text-[11px]' : 'text-xs'
              }`}
            >
              <X size={compact ? 11 : 14} aria-hidden /> Processing failed
            </p>
            {failureDetail && (
              <p className={`mt-0.5 text-red-600 ${compact ? 'text-[10px]' : 'text-[11px]'}`}>
                {failureDetail}
              </p>
            )}
          </div>
        ) : (
          <p
            className={`flex items-center gap-1 text-blue-500 ${
              compact ? 'text-[11px]' : 'text-xs'
            }`}
          >
            <span
              className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"
              aria-hidden
            />
            Processing…
          </p>
        )}
        {confirming && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-[#4A4A4A]">Delete this file?</span>
            <button
              type="button"
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="rounded-md bg-red-500 px-2 py-1 font-medium text-white disabled:opacity-50"
            >
              {deleting ? 'Deleting…' : 'Yes, delete'}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={deleting}
              className="rounded-md border border-[#E0E0E0] px-2 py-1 text-[#4A4A4A]"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
      {!confirming && (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#8C8C8C] active:bg-[#F5F5F5] md:hover:bg-[#F5F5F5] md:hover:text-red-500"
          aria-label={`Delete ${file.filename}`}
        >
          <Trash2 size={15} />
        </button>
      )}
    </div>
  )
}
