import RemiSphere from './RemiSphere'

type RemiLauncherProps = {
  onClick: () => void
  hasUnread?: boolean
}

export default function RemiLauncher({ onClick, hasUnread = false }: RemiLauncherProps) {
  return (
    <div
      className="fixed bottom-[20px] right-[20px] z-50 flex flex-col items-center gap-1.5"
      data-testid="remi-launcher"
    >
      <button
        type="button"
        onClick={onClick}
        className="group relative h-[68px] w-[68px] rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F59E0B] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FAFAFA]"
        aria-label="Open Remi chat"
      >
        <RemiSphere size={68} />
        {/* subtle white ring on hover */}
        <span
          className="pointer-events-none absolute inset-0 rounded-full border-2 border-white/30 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          aria-hidden
        />
        {/* unread notification dot */}
        {hasUnread && (
          <span
            className="absolute right-0 top-0 h-[8px] w-[8px] rounded-full bg-[#F59E0B] ring-2 ring-[#FAFAFA]"
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
