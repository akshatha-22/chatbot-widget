import RemiSphere from './RemiSphere'
import { useWidgetTheme } from './WidgetThemeContext'
import { launcherAnchorClasses } from '../../utils/widgetPosition'

type RemiLauncherProps = {
  onClick: () => void
  hasUnread?: boolean
}

export default function RemiLauncher({ onClick, hasUnread = false }: RemiLauncherProps) {
  const { position } = useWidgetTheme()
  return (
    <div
      className={`fixed z-50 flex flex-col items-center gap-1.5 ${launcherAnchorClasses(position)}`}
      data-testid="remi-launcher"
    >
      <button
        type="button"
        onClick={onClick}
        className="group relative flex h-[68px] w-[68px] items-center justify-center overflow-visible rounded-full border-0 bg-transparent p-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2979FF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FAFAFA]"
        aria-label="Open Remi chat"
      >
        <RemiSphere size={68} />
        {hasUnread && (
          <span
            className="absolute right-0 top-0 h-[8px] w-[8px] rounded-full bg-[#2979FF] ring-2 ring-[#FAFAFA]"
            aria-label="Unread messages"
          />
        )}
      </button>
      <span className="select-none text-[11px] font-semibold tracking-wide text-[#4A4A4A]">
        Remi
      </span>
    </div>
  )
}
