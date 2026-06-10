import { useMemo, useState, useRef, useEffect } from 'react'
import {
  Search,
  Star,
  Plus,
  MoreVertical,
  Trash2,
  Archive,
  ArchiveRestore,
} from 'lucide-react'
import type { Conversation } from '../../types'
import { filterByFolder, type ConvCategory } from '../../utils/conversationFoldersStorage'

type MobileConversationListProps = {
  conversations: Conversation[]
  starredIds: Set<string>
  archivedIds: Set<string>
  trashedIds: Set<string>
  activeId?: string
  search: string
  onSearchChange: (q: string) => void
  onNewConversation: () => void
  onSelectConversation: (conv: Conversation) => void
  onToggleStar: (id: string) => void
  onArchiveConversation: (id: string) => void
  onUnarchiveConversation: (id: string) => void
  onTrashConversation: (id: string) => void
  onRestoreConversation: (id: string) => void
  onDeleteConversation: (id: string) => void
  onViewAllDashboard?: () => void
}

function formatTimeAgo(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${Math.max(1, mins)}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 48) return `${hrs}h`
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

const EMPTY_MESSAGES: Record<ConvCategory, string> = {
  All: 'No conversations yet. Start a new one above.',
  Starred: 'No starred conversations.',
  Archived: 'No archived conversations.',
  Trash: 'Trash is empty.',
}

export default function MobileConversationList({
  conversations,
  starredIds,
  archivedIds,
  trashedIds,
  activeId,
  search,
  onSearchChange,
  onNewConversation,
  onSelectConversation,
  onToggleStar,
  onArchiveConversation,
  onUnarchiveConversation,
  onTrashConversation,
  onRestoreConversation,
  onDeleteConversation,
  onViewAllDashboard,
}: MobileConversationListProps) {
  const [category, setCategory] = useState<ConvCategory>('All')
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpenId) return
    const close = (e: MouseEvent) => {
      const target = e.target as Node
      if (listRef.current?.contains(target)) return
      setMenuOpenId(null)
    }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [menuOpenId])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = filterByFolder(
      conversations,
      category,
      starredIds,
      archivedIds,
      trashedIds,
    )
    if (q) {
      list = list.filter((c) => c.title.toLowerCase().includes(q))
    }
    return list
  }, [conversations, search, category, starredIds, archivedIds, trashedIds])

  const categories: ConvCategory[] = ['All', 'Starred', 'Archived', 'Trash']

  return (
    <div className="isolate flex h-full min-h-0 flex-col overflow-hidden bg-[#FAFAFA]">
      <div className="shrink-0 space-y-3 px-3 pt-3 pb-1">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#ACACAC]"
          />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search conversations"
            className="w-full rounded-xl border-none bg-[#F5F5F5] py-2.5 pl-8 pr-4 text-base text-[#1A1A1A] outline-none focus:bg-[#EBEBEB]"
          />
        </div>

        {category === 'All' && (
          <button
            type="button"
            onClick={onNewConversation}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#2979FF] py-3 text-sm font-medium text-white active:scale-[0.98] md:hover:bg-[#1565C0]"
          >
            <Plus size={16} />
            New Conversation
          </button>
        )}
      </div>

      <div className="scrollbar-hide flex shrink-0 gap-2 overflow-x-auto px-3 py-2 touch-scroll">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => {
              setCategory(cat)
              setMenuOpenId(null)
            }}
            className={`shrink-0 rounded-full px-3 py-2 text-xs font-medium active:opacity-80 ${
              category === cat
                ? 'bg-[#2979FF] text-white'
                : 'bg-[#F0F0F0] text-[#4A4A4A]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div
        ref={listRef}
        className="relative z-0 flex flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-3 pt-1 pb-4 touch-scroll"
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      >
        {filtered.map((c) => {
          const starred = starredIds.has(c.id)
          const isActive = activeId === c.id
          const menuOpen = menuOpenId === c.id
          const isArchived = archivedIds.has(c.id)
          const isTrashed = trashedIds.has(c.id)
          const statusLabel = isTrashed
            ? 'Trash'
            : isArchived
              ? 'Archived'
              : 'Active'
          const statusCls = isTrashed
            ? 'bg-red-50 text-red-600'
            : isArchived
              ? 'bg-blue-50 text-blue-700'
              : 'bg-green-50 text-green-600'

          return (
            <div
              key={c.id}
              className={`relative overflow-hidden rounded-xl border border-[#F0F0F0] bg-white shadow-sm ${
                isActive ? 'ring-2 ring-[#2979FF]/50' : ''
              } ${menuOpen ? 'z-20' : 'z-0'}`}
            >
              <div
                role="button"
                tabIndex={0}
                onClick={() => {
                  if (category !== 'Trash') onSelectConversation(c)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    if (category !== 'Trash') onSelectConversation(c)
                  }
                }}
                className={`flex min-h-[44px] flex-col p-4 ${
                  category !== 'Trash'
                    ? 'cursor-pointer active:bg-[#FAFAFA]'
                    : 'cursor-default'
                }`}
              >
                <div className="mb-2 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onToggleStar(c.id)
                    }}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg active:bg-[#F5F5F5]"
                    aria-label={starred ? 'Unstar' : 'Star'}
                  >
                    <Star
                      size={16}
                      className={starred ? 'text-[#2979FF]' : 'text-[#ACACAC]'}
                      fill={starred ? 'currentColor' : 'none'}
                    />
                  </button>
                  <p className="min-w-0 flex-1 truncate text-sm font-medium text-[#1A1A1A]">
                    {c.title}
                  </p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setMenuOpenId(menuOpen ? null : c.id)
                    }}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[#8C8C8C] active:bg-[#F5F5F5]"
                    aria-label="Conversation options"
                    aria-expanded={menuOpen}
                  >
                    <MoreVertical size={18} />
                  </button>
                </div>
                <div className="flex items-center justify-between pl-11">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusCls}`}
                  >
                    {statusLabel}
                  </span>
                  <span className="text-xs text-[#ACACAC]">
                    {formatTimeAgo(c.created_at)}
                  </span>
                </div>
              </div>

              {menuOpen && (
                <div
                  className="absolute right-3 top-12 z-30 min-w-[168px] overflow-hidden rounded-xl border border-[#F0F0F0] bg-white py-1 shadow-lg"
                  role="menu"
                >
                  {isTrashed ? (
                    <>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={(e) => {
                          e.stopPropagation()
                          setMenuOpenId(null)
                          onRestoreConversation(c.id)
                        }}
                        className="flex min-h-[44px] w-full items-center gap-2 px-4 text-sm text-[#1A1A1A] active:bg-[#F5F5F5]"
                      >
                        <ArchiveRestore size={16} />
                        Restore
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={(e) => {
                          e.stopPropagation()
                          setMenuOpenId(null)
                          void onDeleteConversation(c.id)
                        }}
                        className="flex min-h-[44px] w-full items-center gap-2 px-4 text-sm text-red-600 active:bg-red-50"
                      >
                        <Trash2 size={16} />
                        Delete permanently
                      </button>
                    </>
                  ) : (
                    <>
                      {!isArchived && (
                        <button
                          type="button"
                          role="menuitem"
                          onClick={(e) => {
                            e.stopPropagation()
                            setMenuOpenId(null)
                            onArchiveConversation(c.id)
                          }}
                          className="flex min-h-[44px] w-full items-center gap-2 px-4 text-sm text-[#1A1A1A] active:bg-[#F5F5F5]"
                        >
                          <Archive size={16} />
                          Archive
                        </button>
                      )}
                      {isArchived && (
                        <button
                          type="button"
                          role="menuitem"
                          onClick={(e) => {
                            e.stopPropagation()
                            setMenuOpenId(null)
                            onUnarchiveConversation(c.id)
                          }}
                          className="flex min-h-[44px] w-full items-center gap-2 px-4 text-sm text-[#1A1A1A] active:bg-[#F5F5F5]"
                        >
                          <ArchiveRestore size={16} />
                          Unarchive
                        </button>
                      )}
                      <button
                        type="button"
                        role="menuitem"
                        onClick={(e) => {
                          e.stopPropagation()
                          setMenuOpenId(null)
                          onTrashConversation(c.id)
                        }}
                        className="flex min-h-[44px] w-full items-center gap-2 px-4 text-sm text-[#1A1A1A] active:bg-[#F5F5F5]"
                      >
                        <Trash2 size={16} />
                        Move to trash
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={(e) => {
                          e.stopPropagation()
                          setMenuOpenId(null)
                          void onDeleteConversation(c.id)
                        }}
                        className="flex min-h-[44px] w-full items-center gap-2 px-4 text-sm text-red-600 active:bg-red-50"
                      >
                        <Trash2 size={16} />
                        Delete permanently
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
        {filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-[#8C8C8C]">
            {EMPTY_MESSAGES[category]}
          </p>
        )}
      </div>

      {onViewAllDashboard && (
        <div className="shrink-0 border-t border-[#F0F0F0] bg-[#FAFAFA] px-3 py-3">
          <button
            type="button"
            onClick={onViewAllDashboard}
            className="min-h-[44px] w-full rounded-lg py-2.5 text-sm font-medium text-[#1565C0] active:bg-[#E3F2FD] md:hover:bg-[#E3F2FD]"
          >
            View All Conversations
          </button>
        </div>
      )}
    </div>
  )
}
