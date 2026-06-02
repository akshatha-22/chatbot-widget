import { useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import {
  UploadCloud,
  FileText,
  FileSpreadsheet,
  X,
  Loader2,
  Check,
} from 'lucide-react'
import type { UploadedFile } from '../../types'
import { uploadFile } from '../../api/files'

const MAX_FILE_BYTES = 100 * 1024 * 1024
const MAX_FILES_PER_BATCH = 10
const SUPPORTED_EXTS = ['pdf', 'txt', 'docx', 'xlsx', 'md'] as const
type SupportedExt = (typeof SUPPORTED_EXTS)[number]

type UploadRow = {
  id: string
  file: File
  uploading: boolean
  error?: string
  uploaded?: UploadedFile
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const v = bytes / Math.pow(1024, i)
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

function getExt(fileName: string): SupportedExt | null {
  const parts = fileName.split('.')
  const ext = (parts[parts.length - 1] || '').trim().toLowerCase()
  return SUPPORTED_EXTS.includes(ext as SupportedExt) ? (ext as SupportedExt) : null
}

function pickFileIcon(ext: SupportedExt) {
  if (ext === 'xlsx') return <FileSpreadsheet size={18} className="text-indigo-500" />
  return <FileText size={18} className="text-indigo-500" />
}

export interface FileUploadModalProps {
  open: boolean
  conversationId: string
  files?: UploadedFile[]
  onClose: () => void
  onUploaded?: (file: UploadedFile) => void
}

export default function FileUploadModal({
  open,
  conversationId,
  files = [],
  onClose,
  onUploaded,
}: FileUploadModalProps) {
  const [rows, setRows] = useState<UploadRow[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploadingBatch, setUploadingBatch] = useState(false)

  const acceptAttr = useMemo(() => '.pdf,.txt,.docx,.xlsx,.md', [])

  const validateFiles = (files: File[]): { ok: File[]; errors: string[] } => {
    const ok: File[] = []
    const errors: string[] = []
    for (const f of files) {
      const ext = getExt(f.name)
      if (!ext) {
        errors.push(`${f.name}: unsupported format`)
        continue
      }
      if (f.size > MAX_FILE_BYTES) {
        errors.push(`${f.name}: exceeds 100MB`)
        continue
      }
      ok.push(f)
      if (ok.length >= MAX_FILES_PER_BATCH) break
    }
    return { ok, errors }
  }

  const addFiles = async (files: File[]) => {
    if (!files.length) return
    const { ok } = validateFiles(files)
    if (!ok.length) return

    setUploadingBatch(true)
    try {
      for (const file of ok) {
        const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`
        setRows((prev) => [
          ...prev,
          {
            id,
            file,
            uploading: true,
          },
        ])

        try {
          const uploaded = await uploadFile(conversationId, file)
          setRows((prev) =>
            prev.map((r) =>
              r.id === id ? { ...r, uploading: false, uploaded } : r,
            ),
          )
          onUploaded?.(uploaded)
        } catch (e) {
          const msg =
            e instanceof Error ? e.message : 'Upload failed. Try again.'
          setRows((prev) =>
            prev.map((r) =>
              r.id === id ? { ...r, uploading: false, error: msg } : r,
            ),
          )
        }
      }
    } finally {
      setUploadingBatch(false)
    }
  }

  const handleFilesSelected = async (
    e: ChangeEvent<HTMLInputElement>,
  ) => {
    const list = e.target.files
    if (!list) return
    await addFiles(Array.from(list))
    e.target.value = ''
  }

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    const list = e.dataTransfer.files
    if (!list) return
    await addFiles(Array.from(list))
  }

  const handleRemove = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id))
  }

  const rowStatus = (row: UploadRow): UploadedFile['status'] | undefined => {
    if (!row.uploaded) return undefined
    const live = files.find((f) => f.id === row.uploaded!.id)
    return live?.status ?? row.uploaded.status
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[80] flex max-md:items-end md:items-center md:justify-center md:bg-black/40"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="max-h-[92vh] w-full overflow-hidden bg-white shadow-2xl max-md:animate-slideInUp max-md:rounded-t-2xl md:max-w-2xl md:rounded-xl">
        <div className="md:hidden mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-gray-200" />
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <div>
            <div className="text-sm font-semibold text-gray-800">Upload files</div>
            <div className="mt-0.5 text-xs text-gray-500">
              PDF, TXT, DOCX, XLSX, MD — Max 100MB
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md p-1.5 text-gray-400 active:bg-gray-100 md:hover:bg-gray-100 md:hover:text-gray-700"
            aria-label="Close"
            disabled={uploadingBatch}
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto p-4 touch-scroll max-md:max-h-[70vh]">
          <div
            onDragOver={(e) => {
              e.preventDefault()
              e.stopPropagation()
            }}
            onDrop={handleDrop}
            className={`flex h-36 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 md:h-auto md:rounded-lg md:p-6 ${
              uploadingBatch
                ? 'opacity-60'
                : 'active:bg-gray-50 md:hover:border-indigo-400 md:hover:bg-indigo-50'
            }`}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
          >
            <UploadCloud size={22} className="text-indigo-500" />
            <div className="text-sm font-medium text-gray-800">
              Drag &amp; drop files here or tap to browse
            </div>
            <div className="text-xs text-gray-500">You can upload multiple files.</div>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept={acceptAttr}
            className="hidden"
            multiple
            onChange={handleFilesSelected}
          />

          {rows.length > 0 && (
            <div className="mt-4">
              <div className="mb-2 text-xs font-semibold text-gray-700">
                Uploaded files
              </div>
              <div className="space-y-2">
                {rows.map((r) => {
                  const ext = getExt(r.file.name)
                  const status = rowStatus(r)
                  return (
                    <div
                      key={r.id}
                      className="flex min-h-[44px] items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2"
                    >
                      {ext ? pickFileIcon(ext) : <FileText size={18} className="text-indigo-500" />}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-medium text-gray-800">
                          {r.file.name}
                        </div>
                        <div className="text-[11px] tabular-nums text-gray-500">
                          {formatBytes(r.file.size)}
                        </div>
                        {r.uploading && (
                          <div className="mt-1 flex items-center gap-1 text-xs text-indigo-600">
                            <Loader2 size={14} className="animate-spin" />
                            Uploading…
                          </div>
                        )}
                        {!r.uploading && status === 'pending' && (
                          <div className="mt-1 flex items-center gap-1 text-xs text-amber-500">
                            <span
                              className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-amber-500 border-t-transparent"
                              aria-hidden
                            />
                            Processing…
                          </div>
                        )}
                        {!r.uploading && status === 'processed' && (
                          <div className="mt-1 flex items-center gap-1 text-xs text-green-500">
                            <Check size={12} aria-hidden />
                            Ready
                          </div>
                        )}
                        {!r.uploading && status === 'failed' && (
                          <div className="mt-1 flex items-center gap-1 text-xs text-red-500">
                            <X size={12} aria-hidden />
                            Failed — try again
                          </div>
                        )}
                        {!r.uploading && r.error && (
                          <div className="mt-1 text-xs text-red-600">{r.error}</div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemove(r.id)}
                        className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md p-1.5 text-gray-400 active:bg-red-50 active:text-red-600"
                        aria-label="Remove file from list"
                        disabled={r.uploading}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-gray-100 px-4 py-3 pb-safe max-md:pb-6">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] w-full rounded-lg bg-gray-100 px-3 py-2.5 text-sm text-gray-700 active:bg-gray-200 disabled:opacity-60 md:w-auto md:hover:bg-gray-200"
            disabled={uploadingBatch}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
