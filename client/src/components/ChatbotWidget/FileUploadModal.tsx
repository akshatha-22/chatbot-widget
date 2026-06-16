import { useRef, useState, type ChangeEvent, type DragEvent } from 'react'
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
import {
  getUploadExtension,
  MAX_UPLOAD_BYTES,
  SUPPORTED_UPLOAD_LABEL,
  type SupportedUploadExtension,
} from '../../constants/uploadFormats'

const MAX_FILES_PER_BATCH = 10

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

function pickFileIcon(ext: SupportedUploadExtension) {
  if (ext === 'xlsx' || ext === 'xls') {
    return <FileSpreadsheet size={18} className="text-[#2979FF]" />
  }
  return <FileText size={18} className="text-[#2979FF]" />
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
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [dragActive, setDragActive] = useState(false)

  const validateFiles = (fileList: File[]): { ok: File[]; errors: string[] } => {
    const ok: File[] = []
    const errors: string[] = []
    for (const f of fileList) {
      const ext = getUploadExtension(f.name)
      if (!ext) {
        errors.push(
          `${f.name}: unsupported format. Use ${SUPPORTED_UPLOAD_LABEL.split('—')[0].trim()}.`,
        )
        continue
      }
      if (f.size > MAX_UPLOAD_BYTES) {
        errors.push(`${f.name}: exceeds 100MB limit`)
        continue
      }
      if (f.size <= 0) {
        errors.push(`${f.name}: file is empty`)
        continue
      }
      ok.push(f)
      if (ok.length >= MAX_FILES_PER_BATCH) break
    }
    return { ok, errors }
  }

  const addFiles = async (fileList: File[]) => {
    if (!fileList.length) return
    const { ok, errors } = validateFiles(fileList)
    setValidationErrors(errors)
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

  const handleFilesSelected = async (e: ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files
    if (!list) return
    await addFiles(Array.from(list))
    e.target.value = ''
  }

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    const list = e.dataTransfer.files
    if (!list?.length) return
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
            <div className="mt-0.5 text-xs text-gray-500">{SUPPORTED_UPLOAD_LABEL}</div>
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
            onDragEnter={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setDragActive(true)
            }}
            onDragLeave={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setDragActive(false)
            }}
            onDragOver={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setDragActive(true)
            }}
            onDrop={handleDrop}
            className={`flex h-36 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed md:h-auto md:rounded-lg md:p-6 ${
              dragActive
                ? 'border-[#2979FF] bg-[#E3F2FD]'
                : 'border-gray-200'
            } ${
              uploadingBatch
                ? 'opacity-60'
                : 'active:bg-gray-50 md:hover:border-[#2979FF] md:hover:bg-[#E3F2FD]'
            }`}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                inputRef.current?.click()
              }
            }}
            role="button"
            tabIndex={0}
          >
            <UploadCloud size={22} className="text-[#2979FF]" />
            <div className="text-sm font-medium text-gray-800">
              Drag &amp; drop files here or tap to browse
            </div>
            <div className="px-4 text-center text-xs text-gray-500">
              All files appear in the picker — unsupported types show an error after
              selection. Max 100MB per file.
            </div>
          </div>

          {/* No accept filter: Windows/macOS show every file; we validate after pick. */}
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            multiple
            onChange={handleFilesSelected}
          />

          {validationErrors.length > 0 && (
            <div
              className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
              role="alert"
            >
              <p className="font-semibold">Some files could not be added:</p>
              <ul className="mt-1 list-inside list-disc space-y-0.5">
                {validationErrors.map((err) => (
                  <li key={err}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {rows.length > 0 && (
            <div className="mt-4">
              <div className="mb-2 text-xs font-semibold text-gray-700">
                Uploaded files
              </div>
              <div className="space-y-2">
                {rows.map((r) => {
                  const ext = getUploadExtension(r.file.name)
                  const status = rowStatus(r)
                  return (
                    <div
                      key={r.id}
                      className="flex min-h-[44px] items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2"
                    >
                      {ext ? (
                        pickFileIcon(ext)
                      ) : (
                        <FileText size={18} className="text-[#2979FF]" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-medium text-gray-800">
                          {r.file.name}
                        </div>
                        <div className="text-[11px] tabular-nums text-gray-500">
                          {formatBytes(r.file.size)}
                        </div>
                        {r.uploading && (
                          <div className="mt-1 flex items-center gap-1 text-xs text-[#1565C0]">
                            <Loader2 size={14} className="animate-spin" />
                            Uploading…
                          </div>
                        )}
                        {!r.uploading && status === 'pending' && (
                          <div className="mt-1 flex items-center gap-1 text-xs text-blue-500">
                            <span
                              className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"
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
                            Processing failed — delete and re-upload
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
