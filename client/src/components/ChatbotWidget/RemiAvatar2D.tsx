type RemiAvatar2DProps = {
  /** Diameter in pixels. Defaults to 40. */
  size?: number
  className?: string
}

/**
 * Static flat 2D Remi mascot — flat amber circle with dot eyes.
 * Same palette as RemiSphere; no gradients or 3D gloss.
 */
export default function RemiAvatar2D({ size = 40, className = '' }: RemiAvatar2DProps) {
  return (
    <svg
      viewBox="0 0 40 40"
      width={size}
      height={size}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      {/* Flat circle — no radial gradient */}
      <circle cx="20" cy="20" r="18" fill="#FBBF24" />

      <path
        d="M13 15.5 Q15 14 17 15.5"
        stroke="#92400E"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M23 15.5 Q25 14 27 15.5"
        stroke="#92400E"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
      />

      {/* Small round dot eyes */}
      <circle cx="14.5" cy="18.5" r="1.5" fill="#92400E" />
      <circle cx="25.5" cy="18.5" r="1.5" fill="#92400E" />

      <path
        d="M15 25 Q20 28.5 25 25"
        stroke="#92400E"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
      />

      <ellipse cx="12" cy="23" rx="3.5" ry="2" fill="#FCA5A5" opacity="0.45" />
      <ellipse cx="28" cy="23" rx="3.5" ry="2" fill="#FCA5A5" opacity="0.45" />
    </svg>
  )
}
