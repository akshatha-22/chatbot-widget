import { useEffect, useState } from 'react'

type RateLimitBannerProps = {
  retryAfterSeconds: number
  onExpired?: () => void
}

function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes > 0) {
    return `${minutes}m ${seconds.toString().padStart(2, '0')}s`
  }
  return `${seconds}s`
}

export function RateLimitBanner({
  retryAfterSeconds,
  onExpired,
}: RateLimitBannerProps) {
  const [remaining, setRemaining] = useState(retryAfterSeconds)

  useEffect(() => {
    setRemaining(retryAfterSeconds)
  }, [retryAfterSeconds])

  useEffect(() => {
    if (remaining <= 0) {
      onExpired?.()
      return
    }

    const timer = window.setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer)
          onExpired?.()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => window.clearInterval(timer)
  }, [remaining, onExpired])

  if (remaining <= 0) {
    return null
  }

  return (
    <div
      role="status"
      className="mx-3 mb-2 rounded-lg border border-remi-400/40 bg-remi-50 px-3 py-2 text-sm text-remi-700"
    >
      Daily message limit reached. You can send again in{' '}
      <span className="font-semibold tabular-nums">{formatCountdown(remaining)}</span>.
    </div>
  )
}
