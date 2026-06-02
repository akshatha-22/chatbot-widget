import { MessageSquare, LayoutList, Paperclip } from 'lucide-react'

export type MobileTabId = 'chat' | 'conversations' | 'files'

type MobileTabBarProps = {
  active: MobileTabId
  onChange: (tab: MobileTabId) => void
}

const TABS: { id: MobileTabId; icon: typeof MessageSquare; label: string }[] = [
  { id: 'chat', icon: MessageSquare, label: 'Chat' },
  { id: 'conversations', icon: LayoutList, label: 'Chats' },
  { id: 'files', icon: Paperclip, label: 'Files' },
]

export default function MobileTabBar({ active, onChange }: MobileTabBarProps) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-[60] flex h-[3.5rem] min-h-[44px] border-t border-[#F0F0F0] bg-white pb-safe md:hidden"
      aria-label="Widget sections"
    >
      {TABS.map((tab) => {
        const Icon = tab.icon
        const isActive = active === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 text-xs transition-colors active:opacity-80 ${
              isActive ? 'text-[#F59E0B]' : 'text-[#8C8C8C]'
            }`}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon size={18} strokeWidth={1.5} />
            <span>{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
