import { useState } from 'react'
import {
  ChevronDown,
  Download,
  Sparkles,
  MoreHorizontal,
  Loader2,
  Check,
} from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import type { Conversation, Message } from '../../types'
import { generateConversationFile } from '../../api/chat'
import { appendGeneratedFile } from '../../utils/generatedFilesStorage'
import { downloadFile } from '../../utils/downloadFile'
import {
  exportCsv,
  exportHtml,
  exportJson,
  exportMd,
  exportPdf,
  exportTxt,
  downloadTextAsPdf,
} from '../../utils/exportConversation'

type GenerateType = 'summary' | 'report' | 'analysis'
type OutputFormat = 'txt' | 'pdf' | 'docx'
type ExportFormat = 'txt' | 'pdf' | 'json' | 'md' | 'html' | 'csv'

const GENERATE_TYPES: { value: GenerateType; label: string }[] = [
  { value: 'summary', label: 'Summary' },
  { value: 'report', label: 'Report' },
  { value: 'analysis', label: 'Analysis' },
]

const OUTPUT_FORMATS: { value: OutputFormat; label: string }[] = [
  { value: 'pdf', label: 'PDF' },
  { value: 'docx', label: 'DOCX' },
  { value: 'txt', label: 'TXT' },
]

export interface FileGenerationPanelProps {
  conversation: Conversation | null
  messages: Message[]
}

export default function FileGenerationPanel({
  conversation,
  messages,
}: FileGenerationPanelProps) {
  const [genType, setGenType] = useState<GenerateType>('summary')
  const [outFormat, setOutFormat] = useState<OutputFormat>('pdf')
  const [generating, setGenerating] = useState(false)
  const [exporting, setExporting] = useState<ExportFormat | 'generate' | null>(
    null,
  )
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const canUse = Boolean(conversation?.id)
  const busy = generating || exporting !== null

  const flashSuccess = (msg = 'Downloaded!') => {
    setSuccessMsg(msg)
    window.setTimeout(() => setSuccessMsg(null), 2000)
  }

  const runExport = async (fmt: ExportFormat, fn: () => void) => {
    if (!conversation || busy) return
    setError(null)
    setExporting(fmt)
    try {
      await new Promise((r) => window.setTimeout(r, 0))
      fn()
      flashSuccess()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setExporting(null)
    }
  }

  const handleExport = (fmt: ExportFormat) => {
    if (!conversation) return
    const runners: Record<ExportFormat, () => void> = {
      txt: () => exportTxt(conversation, messages),
      md: () => exportMd(conversation, messages),
      json: () => exportJson(conversation, messages),
      pdf: () => exportPdf(conversation, messages),
      html: () => exportHtml(conversation, messages),
      csv: () => exportCsv(conversation, messages),
    }
    void runExport(fmt, runners[fmt])
  }

  const handleGenerate = async () => {
    if (!conversation || busy) return
    setGenerating(true)
    setExporting('generate')
    setError(null)
    try {
      const result = await generateConversationFile(conversation.id, {
        type: genType,
        format: outFormat,
      })

      appendGeneratedFile(conversation.id, {
        filename: result.filename,
        format: result.format,
        type: genType,
        content: result.content,
      })

      if (result.format === 'pdf') {
        downloadTextAsPdf(result.filename, result.content, result.filename)
      } else if (result.format === 'docx') {
        downloadFile(
          result.content,
          result.filename,
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        )
      } else {
        downloadFile(result.content, result.filename, 'text/plain;charset=utf-8')
      }

      flashSuccess('Downloaded!')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate file')
    } finally {
      setGenerating(false)
      setExporting(null)
    }
  }

  const exportButtonLabel = (fmt: ExportFormat, label: string) => {
    if (exporting === fmt) {
      return (
        <span className="flex items-center justify-center gap-1.5">
          <Loader2 size={14} className="animate-spin" />
          …
        </span>
      )
    }
    return label
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-gray-800">
              Generate & Export
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              Generate files from this conversation or export the raw chat.
            </div>
          </div>
          {successMsg ? (
            <span className="flex items-center gap-1 text-xs font-medium text-green-600 shrink-0">
              <Check size={14} />
              {successMsg}
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <section className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-gray-800">
                Generate File
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                AI summary, report, or analysis via Gemini.
              </div>
            </div>
            <Sparkles size={18} className="text-indigo-500" />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="text-xs font-medium text-gray-600">
              Type
              <div className="mt-1 relative">
                <select
                  value={genType}
                  onChange={(e) => setGenType(e.target.value as GenerateType)}
                  disabled={!canUse || busy}
                  className="w-full appearance-none text-sm rounded-lg border border-gray-200 bg-white px-3 py-2 pr-8 outline-none focus:border-indigo-400 disabled:opacity-50"
                >
                  {GENERATE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={14}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                />
              </div>
            </label>

            <label className="text-xs font-medium text-gray-600">
              Output Format
              <div className="mt-1 relative">
                <select
                  value={outFormat}
                  onChange={(e) => setOutFormat(e.target.value as OutputFormat)}
                  disabled={!canUse || busy}
                  className="w-full appearance-none text-sm rounded-lg border border-gray-200 bg-white px-3 py-2 pr-8 outline-none focus:border-indigo-400 disabled:opacity-50"
                >
                  {OUTPUT_FORMATS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={14}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                />
              </div>
            </label>
          </div>

          <button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={!canUse || busy}
            className="mt-3 w-full px-3 py-2 rounded-lg bg-indigo-500 text-white text-sm font-semibold hover:bg-indigo-600 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {generating ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Generating…
              </>
            ) : (
              'Generate'
            )}
          </button>

          {!canUse && (
            <p className="mt-2 text-xs text-gray-400">
              Select a conversation to generate a file.
            </p>
          )}
        </section>

        <section className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-gray-800">
                Export Conversation
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                Download the raw chat in common formats.
              </div>
            </div>
            <Download size={18} className="text-indigo-500" />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleExport('txt')}
              disabled={!canUse || busy}
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {exportButtonLabel('txt', 'TXT')}
            </button>
            <button
              type="button"
              onClick={() => handleExport('pdf')}
              disabled={!canUse || busy}
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {exportButtonLabel('pdf', 'PDF')}
            </button>
            <button
              type="button"
              onClick={() => handleExport('json')}
              disabled={!canUse || busy}
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {exportButtonLabel('json', 'JSON')}
            </button>
            <button
              type="button"
              onClick={() => handleExport('md')}
              disabled={!canUse || busy}
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {exportButtonLabel('md', 'MD')}
            </button>
          </div>

          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                disabled={!canUse || busy}
                className="mt-2 w-full px-3 py-2 rounded-lg bg-gray-100 text-sm text-gray-700 hover:bg-gray-200 disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {exporting === 'html' || exporting === 'csv' ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <MoreHorizontal size={16} />
                )}
                More formats
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                className="min-w-[180px] bg-white rounded-lg border border-gray-200 shadow-lg py-1 z-[60]"
                sideOffset={6}
                align="center"
              >
                <DropdownMenu.Item
                  className="px-3 py-2 text-sm text-gray-700 outline-none cursor-pointer hover:bg-gray-50 data-[highlighted]:bg-gray-50"
                  disabled={!canUse || busy}
                  onSelect={() => handleExport('html')}
                >
                  Export as HTML
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="px-3 py-2 text-sm text-gray-700 outline-none cursor-pointer hover:bg-gray-50 data-[highlighted]:bg-gray-50"
                  disabled={!canUse || busy}
                  onSelect={() => handleExport('csv')}
                >
                  Export as CSV
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </section>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
      </div>

      <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
        <p className="text-xs text-gray-500">
          Exports download directly to your device. Generated files are also
          saved in this conversation&apos;s history.
        </p>
      </div>
    </div>
  )
}
