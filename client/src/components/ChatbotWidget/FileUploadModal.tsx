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
    // allow selecting the same file again
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

  /** Parent polls listFiles — use live status when available. */
  const rowStatus = (row: UploadRow): UploadedFile['status'] | undefined => {
    if (!row.uploaded) return undefined
    const live = files.find((f) => f.id === row.uploaded!.id)
    return live?.status ?? row.uploaded.status
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div>
            <div className="text-sm font-semibold text-gray-800">Upload files</div>
            <div className="text-xs text-gray-500 mt-0.5">
              PDF, TXT, DOCX, XLSX, MD — Max 100MB
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100"
            aria-label="Close"
            disabled={uploadingBatch}
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4">
          <div
            onDragOver={(e) => {
              e.preventDefault()
              e.stopPropagation()
            }}
            onDrop={handleDrop}
            className={`w-full border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center gap-2 cursor-pointer ${
              uploadingBatch ? 'opacity-60' : 'hover:border-indigo-400 hover:bg-indigo-50'
            }`}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
          >
            <UploadCloud size={22} className="text-indigo-500" />
            <div className="text-sm font-medium text-gray-800">
              Drag &amp; drop files here or click to browse
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
              <div className="text-xs font-semibold text-gray-700 mb-2">
                Uploaded files
              </div>
              <div className="space-y-2">
                {rows.map((r) => {
                  const ext = getExt(r.file.name)
                  const status = rowStatus(r)
                  return (
                    <div
                      key={r.id}
                      className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 px-3 py-2"
                    >
                      {ext ? pickFileIcon(ext) : <FileText size={18} className="text-indigo-500" />}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-gray-800 truncate">
                          {r.file.name}
                        </div>
                        <div className="text-[11px] text-gray-500 tabular-nums">
                          {formatBytes(r.file.size)}
                        </div>
                        {r.uploading && (
                          <div className="mt-1 text-xs text-indigo-600 flex items-center gap-1">
                            <Loader2 size={14} className="animate-spin" />
                            Uploading…
                          </div>
                        )}
                        {!r.uploading && status === 'pending' && (
                          <div className="mt-1 text-xs text-amber-500 flex items-center gap-1">
                            <span
                              className="w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin shrink-0"
                              aria-hidden
                            />
                            Processing…
                          </div>
                        )}
                        {!r.uploading && status === 'processed' && (
                          <div className="mt-1 text-xs text-green-500 flex items-center gap-1">
                            <Check size={12} aria-hidden />
                            Ready
                          </div>
                        )}
                        {!r.uploading && status === 'failed' && (
                          <div className="mt-1 text-xs text-red-500 flex items-center gap-1">
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
                        className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50"
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

        <div className="px-4 py-3 border-t border-gray-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 rounded-lg bg-gray-100 text-sm text-gray-700 hover:bg-gray-200 disabled:opacity-60"
            disabled={uploadingBatch}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

