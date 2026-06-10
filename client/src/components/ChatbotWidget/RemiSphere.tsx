import { motion } from 'framer-motion'
import RemiFace from './RemiFace'

type RemiSphereProps = {
  /** Diameter in pixels. Defaults to 68 (launcher). */
  size?: number
  /** Accepted for backward compatibility; animation is driven by size. */
  glow?: boolean
  float?: boolean
  className?: string
}

/**
 * Circular Remi launcher sphere — true round clip, hi-DPI eyes, CSS ring glow.
 */
export default function RemiSphere({ size = 68, className = '' }: RemiSphereProps) {
  const showFace = size >= 48

  return (
    <motion.div
      className={className}
      whileHover={showFace ? { scale: 1.06 } : undefined}
      transition={{ type: 'spring', stiffness: 400, damping: 18 }}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        cursor: showFace ? 'pointer' : 'default',
        lineHeight: 0,
      }}
    >
      <RemiFace size={size} simplified={!showFace} />
    </motion.div>
  )
}
