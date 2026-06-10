import type { ReactNode } from 'react'
import * as Tooltip from '@radix-ui/react-tooltip'

type NavTooltipProps = {
  label: string
  description?: string
  children: ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
  /** Show hint text under the trigger on touch-first layouts (no hover). */
  showMobileHint?: boolean
}

export function WidgetTooltipProvider({ children }: { children: ReactNode }) {
  return (
    <Tooltip.Provider delayDuration={350} skipDelayDuration={0}>
      {children}
    </Tooltip.Provider>
  )
}

export function NavTooltip({
  label,
  description,
  children,
  side = 'bottom',
  showMobileHint = false,
}: NavTooltipProps) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side={side}
          sideOffset={6}
          collisionPadding={8}
          className="z-[200] max-w-[220px] rounded-lg border border-[#F0F0F0] bg-[#1A1A1A] px-2.5 py-1.5 text-left shadow-lg will-change-transform data-[state=delayed-open]:animate-[fadeIn_150ms_ease-out] data-[state=closed]:animate-[fadeOut_100ms_ease-in]"
        >
          <p className="text-xs font-medium text-white leading-snug">{label}</p>
          {description && (
            <p className="mt-0.5 text-[10px] leading-snug text-[#ACACAC]">
              {description}
            </p>
          )}
          <Tooltip.Arrow className="fill-[#1A1A1A]" />
        </Tooltip.Content>
      </Tooltip.Portal>
      {showMobileHint && (
        <span className="pointer-events-none absolute -bottom-4 left-1/2 hidden -translate-x-1/2 whitespace-nowrap text-[9px] font-medium text-[#8C8C8C] max-md:block md:hidden">
          {label}
        </span>
      )}
    </Tooltip.Root>
  )
}
