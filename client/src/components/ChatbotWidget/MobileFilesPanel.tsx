import { Plus } from 'lucide-react'
import type { Conversation, Message, UploadedFile } from '../../types'
import FileGenerationPanel from './FileGenerationPanel'
import FileListItem from './FileListItem'

type MobileFilesPanelProps = {
  conversation: Conversation | null
  messages: Message[]
  files: UploadedFile[]
  onAddMore: () => void
  onDeleteFile: (fileId: string) => Promise<void>
  onReindexFile?: (fileId: string) => Promise<void>
}

export default function MobileFilesPanel({
  conversation,
  messages,
  files,
  onAddMore,
  onDeleteFile,
  onReindexFile,
}: MobileFilesPanelProps) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-[#FAFAFA] touch-scroll">
      <div className="shrink-0 px-3 pt-3 pb-2">
        <button
          type="button"
          onClick={onAddMore}
          disabled={!conversation}
          className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#2979FF] py-3 text-sm font-medium text-white disabled:opacity-40 active:scale-[0.98] md:hover:bg-[#1565C0]"
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
          <div className="mx-3 space-y-2">
            {files.map((f) => (
              <FileListItem
                key={f.id}
                file={f}
                onDelete={onDeleteFile}
                onReindex={onReindexFile}
              />
            ))}
          </div>
        )}

        <p className="mx-3 mt-4 pb-4 text-center text-xs text-[#8C8C8C]">
          These files are available in this conversation for document Q&amp;A.
        </p>
      </div>
    </div>
  )
}
