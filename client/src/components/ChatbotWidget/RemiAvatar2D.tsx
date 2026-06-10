import RemiFace from './RemiFace'

type RemiAvatar2DProps = {
  /** Diameter in pixels. Defaults to 40. */
  size?: number
  className?: string
}

/**
 * Flat 2D Remi mascot — same face art as RemiSphere, scaled for headers and bubbles.
 */
export default function RemiAvatar2D({ size = 40, className = '' }: RemiAvatar2DProps) {
  return <RemiFace size={size} simplified={size < 36} className={className} />
}
