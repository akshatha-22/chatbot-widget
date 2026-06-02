import { FileText, X, Check, Plus } from 'lucide-react'
import type { Conversation, Message, UploadedFile } from '../../types'
import FileGenerationPanel from './FileGenerationPanel'

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

type MobileFilesPanelProps = {
  conversation: Conversation | null
  messages: Message[]
  files: UploadedFile[]
  onAddMore: () => void
}

export default function MobileFilesPanel({
  conversation,
  messages,
  files,
  onAddMore,
}: MobileFilesPanelProps) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-[#FAFAFA] touch-scroll">
      <div className="shrink-0 px-3 pt-3 pb-2">
        <button
          type="button"
          onClick={onAddMore}
          disabled={!conversation}
          className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#F59E0B] py-3 text-sm font-medium text-white disabled:opacity-40 active:scale-[0.98] md:hover:bg-[#D97706]"
        >
          <Plus size={16} />
          Add More Files
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pb-20 touch-scroll">
        <FileGenerationPanel
          conversation={conversation}
          messages={messages}
          variant="embedded"
        />

        <p className="mx-3 mb-2 mt-2 text-xs font-semibold text-[#4A4A4A]">
          Uploaded files ({files.length})
        </p>

        {files.length === 0 ? (
          <p className="mx-3 text-center text-xs text-[#8C8C8C]">
            No files yet. Upload a PDF, DOCX, or TXT to chat with your documents.
          </p>
        ) : (
          files.map((f) => {
            const processed = f.status === 'processed'
            const failed = f.status === 'failed'
            const statusLabel = processed
              ? 'Ready'
              : failed
                ? 'Failed'
                : 'Processing…'
            return (
              <div
                key={f.id}
                className="mx-3 mb-2 flex min-h-[44px] items-center gap-3 rounded-xl border border-[#F0F0F0] bg-white px-4 py-3"
              >
                <FileText
                  size={20}
                  className="shrink-0"
                  style={{ color: fileIconColor(f.filename) }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[#1A1A1A]">
                    {f.filename}
                  </p>
                  <p className="text-xs text-[#8C8C8C]">{statusLabel}</p>
                </div>
                {processed && (
                  <Check size={16} className="shrink-0 text-green-500" />
                )}
                {failed && <X size={16} className="shrink-0 text-red-500" />}
              </div>
            )
          })
        )}

        <p className="mx-3 mt-4 pb-4 text-center text-xs text-[#8C8C8C]">
          These files are available in this conversation for document Q&amp;A.
        </p>
      </div>
    </div>
  )
}
