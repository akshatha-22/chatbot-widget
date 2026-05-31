import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'

type Expression = {
  name: string
  leftEyebrow: string
  rightEyebrow: string
  leftEye: { cx: number; cy: number }
  rightEye: { cx: number; cy: number }
  mouth: string
}

const expressions: Expression[] = [
  {
    name: 'happy',
    leftEyebrow: 'M11.5 12 Q13 10 14.5 12',
    rightEyebrow: 'M17.5 12 Q19 10 20.5 12',
    leftEye: { cx: 13.5, cy: 17 },
    rightEye: { cx: 18.5, cy: 17 },
    mouth: 'M12.5 23 Q16 26 19.5 23',
  },
  {
    name: 'thinking',
    leftEyebrow: 'M11.5 11 Q13 12 14.5 11',
    rightEyebrow: 'M17.5 10 Q19 12 20.5 10',
    leftEye: { cx: 13.5, cy: 17 },
    rightEye: { cx: 18.5, cy: 16.5 },
    mouth: 'M12.5 24 Q16 23 19.5 24',
  },
  {
    name: 'excited',
    leftEyebrow: 'M11.5 11 Q13 9 14.5 11',
    rightEyebrow: 'M17.5 11 Q19 9 20.5 11',
    leftEye: { cx: 13.5, cy: 16.5 },
    rightEye: { cx: 18.5, cy: 16.5 },
    mouth: 'M11.5 23 Q16 27 20.5 23',
  },
  {
    name: 'calm',
    leftEyebrow: 'M11.5 12 Q13 11 14.5 12',
    rightEyebrow: 'M17.5 12 Q19 11 20.5 12',
    leftEye: { cx: 13.5, cy: 17.2 },
    rightEye: { cx: 18.5, cy: 17.2 },
    mouth: 'M12.5 24 Q16 25.5 19.5 24',
  },
]

const FACE = '#ea580c'

type RemiSphereProps = {
  /** Diameter in pixels. Defaults to 68 (launcher). */
  size?: number
  /** Accepted for backward compatibility; animation is driven by size. */
  glow?: boolean
  float?: boolean
  className?: string
}

/**
 * The yellow 3D Remi sphere. At launcher size (>= 48px) it has a pulsing glow
 * and auto-cycling facial expressions via Framer Motion. Smaller sizes render
 * a static glossy orb (header / bubble avatar) with no face.
 */
export default function RemiSphere({ size = 68, className = '' }: RemiSphereProps) {
  const [expressionIndex, setExpressionIndex] = useState(0)
  const showFace = size >= 48

  useEffect(() => {
    if (!showFace) return
    const interval = setInterval(() => {
      setExpressionIndex((prev) => (prev + 1) % expressions.length)
    }, 2500)
    return () => clearInterval(interval)
  }, [showFace])

  const expr = expressions[expressionIndex]

  return (
    <div
      className={className}
      style={{ position: 'relative', width: size, height: size }}
    >
      {/* Pulsing glow behind the sphere (launcher only) */}
      {showFace && (
        <motion.div
          animate={{ opacity: [0.5, 0.8, 0.5], scale: [1, 1.15, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: 'radial-gradient(circle, #fbbf24, #f59e0b)',
            filter: 'blur(8px)',
            zIndex: 0,
          }}
        />
      )}

      {/* The 3D sphere */}
      <motion.div
        whileHover={{
          scale: 1.1,
          boxShadow: '0 8px 25px rgba(245,158,11,0.6)',
        }}
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background:
            'radial-gradient(circle at 30% 30%, #fbbf24, #f59e0b, #d97706)',
          boxShadow: '0 4px 15px rgba(245,158,11,0.4)',
          zIndex: 1,
          cursor: showFace ? 'pointer' : 'default',
        }}
      >
        {showFace && (
          <svg
            viewBox="0 0 32 32"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          >
            <AnimatePresence mode="wait">
              <motion.g
                key={expr.name}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <path
                  d={expr.leftEyebrow}
                  stroke={FACE}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  fill="none"
                />
                <path
                  d={expr.rightEyebrow}
                  stroke={FACE}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  fill="none"
                />
                <circle
                  cx={expr.leftEye.cx}
                  cy={expr.leftEye.cy}
                  r="1.5"
                  fill={FACE}
                />
                <circle
                  cx={expr.rightEye.cx}
                  cy={expr.rightEye.cy}
                  r="1.5"
                  fill={FACE}
                />
                <path
                  d={expr.mouth}
                  stroke={FACE}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  fill="none"
                />
              </motion.g>
            </AnimatePresence>
          </svg>
        )}
      </motion.div>
    </div>
  )
}
