import { useCallback, useEffect, useState } from 'react'
import RemiFace, { REMI_EXPRESSIONS, type RemiExpression } from './RemiFace'

type RemiLauncherProps = {
  onClick: () => void
}

const CYCLE_MS = 3200

export default function RemiLauncher({ onClick }: RemiLauncherProps) {
  const [expression, setExpression] = useState<RemiExpression>('happy')
  const [hovered, setHovered] = useState(false)

  const cycleExpression = useCallback(() => {
    setExpression((prev) => {
      const idx = REMI_EXPRESSIONS.indexOf(prev)
      return REMI_EXPRESSIONS[(idx + 1) % REMI_EXPRESSIONS.length]
    })
  }, [])

  useEffect(() => {
    const id = window.setInterval(cycleExpression, CYCLE_MS)
    return () => window.clearInterval(id)
  }, [cycleExpression])

  const displayExpression = hovered ? 'wink' : expression

  return (
    <div
      className="fixed bottom-[20px] right-[20px] z-50 flex flex-col items-center gap-1"
      data-testid="remi-launcher"
    >
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
        className="group relative h-[60px] w-[60px] rounded-full transition-transform duration-200 ease-out hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-100"
        aria-label="Open Remi chat"
      >
        <span
          className="pointer-events-none absolute -inset-2 rounded-full bg-amber-400/35 blur-md animate-remi-glow"
          aria-hidden
        />
        <span
          className="relative block h-full w-full overflow-hidden rounded-full shadow-[0_4px_16px_rgba(245,158,11,0.4)] transition-shadow duration-200 group-hover:shadow-[0_10px_32px_rgba(234,88,12,0.45)]"
          style={{
            background:
              'radial-gradient(circle at 32% 26%, #FFF9C4 0%, #FFE566 32%, #FFC933 62%, #FF9F1A 100%)',
          }}
        >
          <span
            className="pointer-events-none absolute left-[14px] top-[11px] h-[9px] w-[14px] rounded-full bg-white/45 blur-[0.5px]"
            aria-hidden
          />
          <RemiFace expression={displayExpression} />
        </span>
      </button>
      <span className="select-none text-[11px] font-semibold tracking-wide text-gray-600">
        Remi
      </span>
    </div>
  )
}
