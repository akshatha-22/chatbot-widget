import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Search, Star } from 'lucide-react'
import { getConversationMessages, getConversations } from '../../api/chat'
import { listFiles } from '../../api/files'
import type { Conversation, Message } from '../../types'
import SearchFilterPanel, {
  DEFAULT_FILTERS,
  type SearchFilters,
} from '../SearchFilterPanel'

type Status = 'active' | 'completed' | 'archived'

type Row = {
  conversation: Conversation
  messages: Message[]
  filesCount: number
  status: Status
  starred: boolean
  lastModified: string
}

function formatTimeAgo(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function statusBadge(status: Status) {
  const cfg =
    status === 'active'
      ? { label: 'Active', cls: 'bg-green-50 text-green-700 border-green-200' }
      : status === 'archived'
        ? { label: 'Archived', cls: 'bg-yellow-50 text-yellow-800 border-yellow-200' }
        : { label: 'Completed', cls: 'bg-gray-100 text-gray-700 border-gray-200' }
  return (
    <span className={`px-2 py-0.5 text-xs rounded-full border ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

function buildPreview(messages: Message[]): { user?: string; assistant?: string } {
  const lastUser = [...messages].reverse().find((m) => m.role === 'user')
  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant')
  return { user: lastUser?.content, assistant: lastAssistant?.content }
}

function isWithinDateFilter(iso: string, f: SearchFilters): boolean {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return true
  const now = new Date()
  if (f.dateRange === 'last7') {
    const min = new Date(now)
    min.setDate(now.getDate() - 7)
    return d >= min
  }
  if (f.dateRange === 'last30') {
    const min = new Date(now)
    min.setDate(now.getDate() - 30)
    return d >= min
  }
  const from = f.customFrom ? new Date(`${f.customFrom}T00:00:00`) : null
  const to = f.customTo ? new Date(`${f.customTo}T23:59:59`) : null
  if (from && d < from) return false
  if (to && d > to) return false
  return true
}

export type WidgetConversationDashboardProps = {
  starredIds: Set<string>
  onToggleStar: (id: string) => void
  onSelectConversation: (conv: Conversation) => void
  onBack: () => void
}

export default function WidgetConversationDashboard({
  starredIds,
  onToggleStar,
  onSelectConversation,
  onBack,
}: WidgetConversationDashboardProps) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<Row[]>([])
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const convs = await getConversations()
        const slice = convs.slice(0, 50)
        const details = await Promise.all(
          slice.map(async (c) => {
            const messages = await getConversationMessages(c.id).catch(() => [])
            const files = await listFiles(c.id).catch(() => [])
            const lastModified =
              messages[messages.length - 1]?.created_at ?? c.created_at
            return {
              conversation: c,
              messages,
              filesCount: files.length,
              status: 'active' as Status,
              starred: starredIds.has(c.id),
              lastModified,
            } satisfies Row
          }),
        )
        if (!cancelled) setRows(details)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [starredIds])

  const filteredRows = useMemo(() => {
    const q = (filters.text || query).trim().toLowerCase()
    let base = rows
    if (q) base = base.filter((r) => r.conversation.title.toLowerCase().includes(q))
    base = base.filter((r) => isWithinDateFilter(r.lastModified, filters))
    if (filters.withFiles && !filters.withoutFiles) {
      base = base.filter((r) => r.filesCount > 0)
    } else if (filters.withoutFiles && !filters.withFiles) {
      base = base.filter((r) => r.filesCount === 0)
    }
    base = base.filter((r) => {
      if (r.status === 'active') return filters.statusActive
      if (r.status === 'completed') return filters.statusCompleted
      return filters.statusArchived
    })
    return base
  }, [rows, query, filters])

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-gray-50">
      <div className="shrink-0 bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center gap-3 mb-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100"
            aria-label="Back to chat"
          >
            <ArrowLeft size={18} />
          </button>
          <h2 className="text-base font-semibold text-gray-800">All Conversations</h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search conversations"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 bg-white outline-none focus:border-indigo-400"
            />
          </div>
          <SearchFilterPanel
            value={filters}
            onClear={() => {
              setFilters(DEFAULT_FILTERS)
              setQuery('')
            }}
            onApply={(next) => {
              setFilters(next)
              setQuery(next.text)
            }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <p className="text-sm text-gray-400">Loading conversations…</p>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="w-10 px-3 py-2 text-left">
                    <Star size={14} className="text-gray-500" aria-label="Starred" />
                  </th>
                  <th className="px-2 py-2 text-left">Title</th>
                  <th className="px-2 py-2 text-left">Preview</th>
                  <th className="w-16 px-2 py-2 text-left">Files</th>
                  <th className="w-28 px-2 py-2 text-left">Modified</th>
                  <th className="w-24 px-2 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r) => {
                  const id = String(r.conversation.id)
                  const preview = buildPreview(r.messages)
                  const starred = starredIds.has(id)
                  return (
                    <tr
                      key={id}
                      className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer"
                      onClick={() => onSelectConversation(r.conversation)}
                    >
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            onToggleStar(id)
                          }}
                          className={`p-1 rounded-md ${
                            starred
                              ? 'text-yellow-500'
                              : 'text-gray-300 hover:text-gray-500'
                          }`}
                          aria-label={starred ? 'Unstar' : 'Star'}
                        >
                          <Star size={16} fill={starred ? 'currentColor' : 'none'} />
                        </button>
                      </td>
                      <td className="px-2 py-2 font-medium text-gray-800 max-w-[140px]">
                        <span className="truncate block">{r.conversation.title}</span>
                      </td>
                      <td className="px-2 py-2 text-gray-600 max-w-[280px]">
                        <div className="truncate text-xs">
                          <span className="font-medium">You:</span> {preview.user ?? '—'}
                        </div>
                        <div className="truncate text-xs">
                          <span className="font-medium">AI:</span>{' '}
                          {preview.assistant ?? '—'}
                        </div>
                      </td>
                      <td className="px-2 py-2 text-gray-600 tabular-nums">
                        {r.filesCount}
                      </td>
                      <td className="px-2 py-2 text-gray-600 text-xs">
                        {formatTimeAgo(r.lastModified)}
                      </td>
                      <td className="px-2 py-2">{statusBadge(r.status)}</td>
                    </tr>
                  )
                })}
                {filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                      No conversations found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
