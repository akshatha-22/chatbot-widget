import { useEffect, useMemo, useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { Calendar, Filter, X } from 'lucide-react'

export type DateRangePreset = 'last30' | 'last7' | 'custom'

export type SearchFilters = {
  text: string
  dateRange: DateRangePreset
  customFrom?: string // yyyy-mm-dd
  customTo?: string // yyyy-mm-dd
  withFiles: boolean
  withoutFiles: boolean
  statusActive: boolean
  statusCompleted: boolean
  statusArchived: boolean
}

export const DEFAULT_FILTERS: SearchFilters = {
  text: '',
  dateRange: 'last30',
  customFrom: undefined,
  customTo: undefined,
  withFiles: false,
  withoutFiles: false,
  statusActive: true,
  statusCompleted: true,
  statusArchived: true,
}

export interface SearchFilterPanelProps {
  value: SearchFilters
  onApply: (next: SearchFilters) => void
  onClear: () => void
}

function clampText(s: string) {
  return s.length > 200 ? s.slice(0, 200) : s
}

export default function SearchFilterPanel({
  value,
  onApply,
  onClear,
}: SearchFilterPanelProps) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<SearchFilters>(value)

  useEffect(() => {
    if (open) setDraft(value)
  }, [open, value])

  const canApply = useMemo(() => {
    if (draft.dateRange !== 'custom') return true
    // allow empty custom dates, but if both set ensure from<=to
    if (draft.customFrom && draft.customTo) return draft.customFrom <= draft.customTo
    return true
  }, [draft])

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
        >
          <Filter size={16} />
          Filter
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          sideOffset={8}
          align="end"
          className="w-[360px] rounded-xl border border-gray-200 bg-white shadow-xl p-4 z-50"
        >
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-gray-800">
              Search &amp; Filters
            </div>
            <button
              type="button"
              className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100"
              aria-label="Close"
              onClick={() => setOpen(false)}
            >
              <X size={16} />
            </button>
          </div>

          {/* Search */}
          <div className="mt-3">
            <label className="text-xs font-medium text-gray-600">Search</label>
            <div className="mt-1 relative">
              <input
                value={draft.text}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, text: clampText(e.target.value) }))
                }
                placeholder="Title contains…"
                className="w-full text-sm rounded-lg border border-gray-200 px-3 py-2 pr-9 outline-none focus:border-indigo-400"
              />
              {draft.text.trim().length > 0 && (
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                  aria-label="Clear search"
                  onClick={() => setDraft((p) => ({ ...p, text: '' }))}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Date range */}
          <div className="mt-4">
            <label className="text-xs font-medium text-gray-600">Date Range</label>
            <div className="mt-1 relative">
              <select
                value={draft.dateRange}
                onChange={(e) =>
                  setDraft((p) => ({
                    ...p,
                    dateRange: e.target.value as DateRangePreset,
                  }))
                }
                className="w-full appearance-none text-sm rounded-lg border border-gray-200 bg-white px-3 py-2 pr-8 outline-none focus:border-indigo-400"
              >
                <option value="last30">Last 30 days</option>
                <option value="last7">Last 7 days</option>
                <option value="custom">Custom</option>
              </select>
              <Calendar
                size={14}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
            </div>

            {draft.dateRange === 'custom' && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div>
                  <div className="text-[11px] text-gray-500">From</div>
                  <input
                    type="date"
                    value={draft.customFrom ?? ''}
                    onChange={(e) =>
                      setDraft((p) => ({ ...p, customFrom: e.target.value || undefined }))
                    }
                    className="mt-1 w-full text-sm rounded-lg border border-gray-200 px-2 py-2 outline-none focus:border-indigo-400"
                  />
                </div>
                <div>
                  <div className="text-[11px] text-gray-500">To</div>
                  <input
                    type="date"
                    value={draft.customTo ?? ''}
                    onChange={(e) =>
                      setDraft((p) => ({ ...p, customTo: e.target.value || undefined }))
                    }
                    className="mt-1 w-full text-sm rounded-lg border border-gray-200 px-2 py-2 outline-none focus:border-indigo-400"
                  />
                </div>
                {draft.customFrom &&
                  draft.customTo &&
                  draft.customFrom > draft.customTo && (
                    <p className="col-span-2 text-xs text-red-600">
                      “From” must be earlier than “To”.
                    </p>
                  )}
              </div>
            )}
          </div>

          {/* Has files */}
          <div className="mt-4">
            <div className="text-xs font-medium text-gray-600">Has Files</div>
            <div className="mt-2 space-y-2">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={draft.withFiles}
                  onChange={(e) => setDraft((p) => ({ ...p, withFiles: e.target.checked }))}
                />
                With files
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={draft.withoutFiles}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, withoutFiles: e.target.checked }))
                  }
                />
                Without files
              </label>
            </div>
          </div>

          {/* Status */}
          <div className="mt-4">
            <div className="text-xs font-medium text-gray-600">Status</div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={draft.statusActive}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, statusActive: e.target.checked }))
                  }
                />
                Active
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={draft.statusCompleted}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, statusCompleted: e.target.checked }))
                  }
                />
                Completed
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={draft.statusArchived}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, statusArchived: e.target.checked }))
                  }
                />
                Archived
              </label>
            </div>
          </div>

          {/* Footer buttons */}
          <div className="mt-5 flex items-center justify-between">
            <button
              type="button"
              className="px-3 py-2 rounded-lg bg-gray-100 text-sm text-gray-700 hover:bg-gray-200"
              onClick={() => {
                onClear()
                setOpen(false)
              }}
            >
              Clear
            </button>
            <button
              type="button"
              disabled={!canApply}
              className="px-3 py-2 rounded-lg bg-indigo-500 text-sm text-white hover:bg-indigo-600 disabled:opacity-50"
              onClick={() => {
                onApply(draft)
                setOpen(false)
              }}
            >
              Apply
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

