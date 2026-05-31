export type RemiExpression = 'happy' | 'surprised' | 'thinking' | 'wink' | 'curious'

export const REMI_EXPRESSIONS: RemiExpression[] = [
  'happy',
  'surprised',
  'thinking',
  'wink',
  'curious',
]

type RemiFaceProps = {
  expression: RemiExpression
}

/** Animated face drawn on the 60×60 Remi sphere. */
export default function RemiFace({ expression }: RemiFaceProps) {
  const eyeY = expression === 'surprised' ? 22 : 24
  const eyeR = expression === 'surprised' ? 5 : 4
  const leftEyeX = expression === 'curious' ? 19 : 21
  const rightEyeX = expression === 'curious' ? 41 : 39

  const leftEye =
    expression === 'wink' ? (
      <path
        d="M17 26 Q21 24 25 26"
        stroke="#5C3D0A"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        className="transition-all duration-300"
      />
    ) : (
      <circle
        cx={leftEyeX}
        cy={eyeY}
        r={eyeR}
        fill="#3D2608"
        className="transition-all duration-300"
      />
    )

  const rightEye = (
    <circle
      cx={rightEyeX}
      cy={eyeY}
      r={eyeR}
      fill="#3D2608"
      className="transition-all duration-300"
    />
  )

  const eyeShine = (
    <>
      {expression !== 'wink' && (
        <circle cx={leftEyeX + 1.5} cy={eyeY - 1.5} r={1.2} fill="white" opacity={0.85} />
      )}
      <circle cx={rightEyeX + 1.5} cy={eyeY - 1.5} r={1.2} fill="white" opacity={0.85} />
    </>
  )

  const leftBrow = browPath(expression, 'left')
  const rightBrow = browPath(expression, 'right')

  const mouth = mouthPath(expression)

  return (
    <svg
      viewBox="0 0 60 60"
      className="absolute inset-0 h-full w-full"
      aria-hidden
    >
      {leftBrow}
      {rightBrow}
      {leftEye}
      {rightEye}
      {eyeShine}
      {mouth}
    </svg>
  )
}

function browPath(expression: RemiExpression, side: 'left' | 'right') {
  const configs: Record<RemiExpression, { left: string; right: string }> = {
    happy: {
      left: 'M14 18 Q21 15 27 18',
      right: 'M33 18 Q39 15 46 18',
    },
    surprised: {
      left: 'M13 14 Q21 11 28 14',
      right: 'M32 14 Q39 11 47 14',
    },
    thinking: {
      left: 'M14 20 Q21 17 27 19',
      right: 'M33 16 Q40 13 46 16',
    },
    wink: {
      left: 'M14 18 Q21 15 27 18',
      right: 'M33 18 Q39 15 46 18',
    },
    curious: {
      left: 'M14 19 Q21 16 27 18',
      right: 'M33 15 Q40 12 46 15',
    },
  }

  const d = configs[expression][side]
  return (
    <path
      key={`${expression}-${side}`}
      d={d}
      stroke="#7A4E12"
      strokeWidth="2.2"
      strokeLinecap="round"
      fill="none"
      className="transition-all duration-300"
    />
  )
}

function mouthPath(expression: RemiExpression) {
  const paths: Record<RemiExpression, string> = {
    happy: 'M20 38 Q30 46 40 38',
    surprised: 'M26 38 Q30 44 34 38 Q30 34 26 38',
    thinking: 'M24 40 Q30 40 36 40',
    wink: 'M20 38 Q30 45 40 38',
    curious: 'M22 39 Q30 43 38 37',
  }

  const isSurprisedO = expression === 'surprised'

  if (isSurprisedO) {
    return (
      <ellipse
        cx={30}
        cy={40}
        rx={5}
        ry={6}
        fill="none"
        stroke="#5C3D0A"
        strokeWidth="2"
        className="transition-all duration-300"
      />
    )
  }

  return (
    <path
      d={paths[expression]}
      stroke="#5C3D0A"
      strokeWidth="2"
      strokeLinecap="round"
      fill="none"
      className="transition-all duration-300"
    />
  )
}
