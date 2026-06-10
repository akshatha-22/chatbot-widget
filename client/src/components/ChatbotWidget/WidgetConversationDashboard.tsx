import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Search, Star, MoreVertical } from 'lucide-react'
import { useIsMobile } from '../../hooks/useIsMobile'
import { getConversationMessages, getConversations } from '../../api/chat'
import { listFiles } from '../../api/files'
import type { Conversation, Message } from '../../types'
import SearchFilterPanel, {
  DEFAULT_FILTERS,
  type SearchFilters,
} from '../SearchFilterPanel'
import { filterByFolder } from '../../utils/conversationFoldersStorage'

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
  archivedIds: Set<string>
  trashedIds: Set<string>
  onToggleStar: (id: string) => void
  onSelectConversation: (conv: Conversation) => void
  onBack: () => void
}

export default function WidgetConversationDashboard({
  starredIds,
  archivedIds,
  trashedIds,
  onToggleStar,
  onSelectConversation,
  onBack,
}: WidgetConversationDashboardProps) {
  const isMobile = useIsMobile()
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<Row[]>([])
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS)
  const [category, setCategory] = useState<'All' | 'Starred' | 'Archived' | 'Trash'>('All')

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
    const folderIds = filterByFolder(
      base.map((r) => r.conversation),
      category,
      starredIds,
      archivedIds,
      trashedIds,
    ).map((c) => String(c.id))
    base = base.filter((r) => folderIds.includes(String(r.conversation.id)))
    return base
  }, [rows, query, filters, category, starredIds, archivedIds, trashedIds])

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-gray-50 max-md:pb-14">
      <div className="shrink-0 border-b border-gray-200 bg-white px-4 py-3">
        <div className="mb-3 flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex min-h-[44px] items-center gap-1 rounded-lg px-2 text-sm text-gray-600 active:bg-gray-100 md:min-w-[44px] md:justify-center md:p-2 md:text-gray-500 md:hover:bg-gray-100"
            aria-label="Back to chat"
          >
            <ArrowLeft size={18} />
            <span className="md:hidden">Back</span>
          </button>
          <h2 className="max-w-[140px] truncate text-base font-semibold text-gray-800 md:max-w-none">
            {isMobile ? 'Conversations' : 'All Conversations'}
          </h2>
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
              className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-base outline-none focus:border-[#2979FF] md:py-2 md:text-sm"
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
        {isMobile && (
          <div className="scrollbar-hide mt-2 flex gap-2 overflow-x-auto touch-scroll">
            {(['All', 'Starred', 'Archived', 'Trash'] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`min-h-[44px] shrink-0 rounded-full px-3 py-1.5 text-xs font-medium active:opacity-80 ${
                  category === cat
                    ? 'bg-[#2979FF] text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto touch-scroll p-4 max-md:px-3">
        {loading ? (
          <p className="text-sm text-gray-400">Loading conversations…</p>
        ) : isMobile ? (
          <div className="flex flex-col gap-2 pb-4">
            {filteredRows.map((r) => {
              const id = String(r.conversation.id)
              const preview = buildPreview(r.messages)
              const starred = starredIds.has(id)
              return (
                <div
                  key={id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectConversation(r.conversation)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onSelectConversation(r.conversation)
                    }
                  }}
                  className="min-h-[44px] cursor-pointer rounded-xl border border-gray-100 bg-white p-4 active:bg-gray-50"
                >
                  <div className="mb-1 flex items-start justify-between">
                    <div className="flex min-w-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onToggleStar(id)
                        }}
                        className="shrink-0 p-2 active:opacity-70"
                        aria-label={starred ? 'Unstar' : 'Star'}
                      >
                        <Star
                          size={14}
                          className={starred ? 'text-yellow-500' : 'text-gray-300'}
                          fill={starred ? 'currentColor' : 'none'}
                        />
                      </button>
                      <span className="max-w-[160px] truncate text-sm font-medium text-gray-800">
                        {r.conversation.title}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 text-xs text-gray-400">
                      <span>{r.filesCount} files</span>
                      <MoreVertical size={14} />
                    </div>
                  </div>
                  <p className="mb-1 truncate text-xs text-gray-500">
                    You: {preview.user ?? '—'}
                  </p>
                  <p className="mb-2 truncate text-xs text-gray-400">
                    AI: {preview.assistant ?? '—'}
                  </p>
                  <div className="flex items-center justify-between">
                    {statusBadge(r.status)}
                    <span className="text-xs text-gray-400">
                      {formatTimeAgo(r.lastModified)}
                    </span>
                  </div>
                </div>
              )
            })}
            {filteredRows.length === 0 && (
              <p className="py-8 text-center text-sm text-gray-400">
                No conversations found.
              </p>
            )}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
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
