/** Extensions the backend can parse and index for document Q&A. */
export const SUPPORTED_UPLOAD_EXTENSIONS = [
  'pdf',
  'txt',
  'docx',
  'xlsx',
  'xls',
  'md',
  'csv',
  'log',
  'json',
] as const

export type SupportedUploadExtension = (typeof SUPPORTED_UPLOAD_EXTENSIONS)[number]

export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024

export const SUPPORTED_UPLOAD_LABEL =
  'PDF, DOCX, XLS/XLSX, TXT, MD, CSV, JSON, LOG — max 100MB each'

export function getUploadExtension(
  fileName: string,
): SupportedUploadExtension | null {
  const parts = fileName.split('.')
  if (parts.length < 2) return null
  const ext = (parts[parts.length - 1] || '').trim().toLowerCase()
  return SUPPORTED_UPLOAD_EXTENSIONS.includes(ext as SupportedUploadExtension)
    ? (ext as SupportedUploadExtension)
    : null
}
