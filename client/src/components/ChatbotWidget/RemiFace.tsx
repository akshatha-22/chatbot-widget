import { useId, useEffect, useState } from 'react'

type RemiFaceProps = {
  size: number
  /** Smaller scale: fewer highlight details */
  simplified?: boolean
  className?: string
}

/**
 * Circular black Remi sphere with soft blue radiant halo + large oval eyes.
 */
export default function RemiFace({ size, simplified = false, className = '' }: RemiFaceProps) {
  const uid = useId().replace(/:/g, '')
  const clipId = `remiClip-${uid}`
  const rimLeft = `remiRimLeft-${uid}`
  const rimRight = `remiRimRight-${uid}`

  const [renderScale, setRenderScale] = useState(2)
  useEffect(() => {
    setRenderScale(Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 2, 3))
  }, [])

  const eyeRx = simplified ? 10.5 : 14.5
  const eyeRy = simplified ? 14.5 : 20
  const eyeGap = simplified ? 4 : 5
  const leftCx = 50 - eyeGap / 2 - eyeRx
  const rightCx = 50 + eyeGap / 2 + eyeRx
  const eyeCy = 44

  const svgRender = Math.round(size * renderScale)
  const haloBlur = Math.round(size * (simplified ? 0.09 : 0.11))
  const haloSpread = Math.round(size * (simplified ? 0.26 : 0.38))

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        position: 'relative',
        flexShrink: 0,
        overflow: 'visible',
      }}
    >
      {/* Soft blue radiant halo — no hard ring */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: size + haloSpread * 2,
          height: size + haloSpread * 2,
          transform: 'translate(-50%, -50%)',
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(41, 121, 255, 1) 0%, rgba(41, 121, 255, 0.72) 30%, rgba(41, 121, 255, 0.38) 52%, rgba(41, 121, 255, 0.16) 68%, transparent 88%)',
          filter: `blur(${haloBlur}px)`,
          opacity: 0.95,
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: size + haloSpread,
          height: size + haloSpread,
          transform: 'translate(-50%, -50%)',
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(100, 181, 255, 0.9) 0%, rgba(41, 121, 255, 0.5) 42%, rgba(41, 121, 255, 0.15) 65%, transparent 82%)',
          filter: `blur(${Math.round(haloBlur * 0.55)}px)`,
          opacity: 1,
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* Black sphere */}
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          position: 'relative',
          zIndex: 1,
          background:
            'radial-gradient(circle at 38% 34%, #2a2a2a 0%, #212121 52%, #1a1a1a 100%)',
          boxShadow: `0 ${Math.round(size * 0.1)}px ${Math.round(size * 0.28)}px rgba(0, 0, 0, 0.38)`,
        }}
      >
        <svg
          viewBox="0 0 100 100"
          width={svgRender}
          height={svgRender}
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            display: 'block',
            pointerEvents: 'none',
            shapeRendering: 'geometricPrecision',
          }}
        >
          <defs>
            <clipPath id={clipId}>
              <circle cx="50" cy="50" r="48" />
            </clipPath>
            <linearGradient id={rimLeft} x1="0%" y1="20%" x2="100%" y2="80%">
              <stop offset="0%" stopColor="#6b7280" />
              <stop offset="45%" stopColor="#d1d5db" />
              <stop offset="100%" stopColor="#ffffff" />
            </linearGradient>
            <linearGradient id={rimRight} x1="100%" y1="20%" x2="0%" y2="80%">
              <stop offset="0%" stopColor="#6b7280" />
              <stop offset="45%" stopColor="#d1d5db" />
              <stop offset="100%" stopColor="#ffffff" />
            </linearGradient>
          </defs>

          <g clipPath={`url(#${clipId})`} className={simplified ? undefined : 'remi-eye-blink'}>
            <ellipse
              cx={leftCx}
              cy={eyeCy}
              rx={eyeRx}
              ry={eyeRy}
              fill="#212121"
              stroke={`url(#${rimLeft})`}
              strokeWidth={simplified ? 1.6 : 2.1}
            />
            <ellipse
              cx={leftCx + 4}
              cy={eyeCy - 7}
              rx={simplified ? 2.8 : 4}
              ry={simplified ? 3.4 : 4.8}
              fill="#ffffff"
            />
            {!simplified && (
              <circle cx={leftCx - 5} cy={eyeCy + 6.5} r={2.2} fill="#ffffff" />
            )}

            <ellipse
              cx={rightCx}
              cy={eyeCy}
              rx={eyeRx}
              ry={eyeRy}
              fill="#212121"
              stroke={`url(#${rimRight})`}
              strokeWidth={simplified ? 1.6 : 2.1}
            />
            <ellipse
              cx={rightCx - 4}
              cy={eyeCy - 7}
              rx={simplified ? 2.8 : 4}
              ry={simplified ? 3.4 : 4.8}
              fill="#ffffff"
            />
            {!simplified && (
              <circle cx={rightCx + 5} cy={eyeCy + 6.5} r={2.2} fill="#ffffff" />
            )}
          </g>
        </svg>
      </div>
    </div>
  )
}
