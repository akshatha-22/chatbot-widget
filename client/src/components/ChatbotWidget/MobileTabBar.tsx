import { MessageSquare, LayoutList, Paperclip } from 'lucide-react'
import { NavTooltip } from './NavTooltip'

export type MobileTabId = 'chat' | 'conversations' | 'files'

type MobileTabBarProps = {
  active: MobileTabId
  onChange: (tab: MobileTabId) => void
  fileCount?: number
}

const TABS: {
  id: MobileTabId
  icon: typeof MessageSquare
  label: string
  hint: string
}[] = [
  {
    id: 'chat',
    icon: MessageSquare,
    label: 'Chat',
    hint: 'Message Remi in this conversation',
  },
  {
    id: 'conversations',
    icon: LayoutList,
    label: 'Chats',
    hint: 'Switch or start another conversation',
  },
  {
    id: 'files',
    icon: Paperclip,
    label: 'Files',
    hint: 'View and upload documents for Q&A',
  },
]

export default function MobileTabBar({
  active,
  onChange,
  fileCount = 0,
}: MobileTabBarProps) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-[60] flex h-[3.75rem] min-h-[44px] border-t border-[#F0F0F0] bg-white pb-safe md:hidden"
      aria-label="Widget sections"
    >
      {TABS.map((tab) => {
        const Icon = tab.icon
        const isActive = active === tab.id
        const badge =
          tab.id === 'files' && fileCount > 0 ? fileCount : null

        return (
          <NavTooltip
            key={tab.id}
            label={tab.label}
            description={tab.hint}
            side="top"
          >
            <button
              type="button"
              onClick={() => onChange(tab.id)}
              className={`relative flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[11px] transition-colors active:opacity-80 ${
                isActive ? 'text-[#2979FF]' : 'text-[#8C8C8C]'
              }`}
              aria-current={isActive ? 'page' : undefined}
              aria-label={
                badge
                  ? `${tab.label}, ${fileCount} files uploaded`
                  : tab.label
              }
            >
              <span className="relative">
                <Icon size={18} strokeWidth={1.5} />
                {badge !== null && (
                  <span className="absolute -right-2 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#2979FF] px-1 text-[9px] font-bold leading-none text-white">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </span>
              <span className="max-w-full truncate">{tab.label}</span>
            </button>
          </NavTooltip>
        )
      })}
    </nav>
  )
}
