import { useEffect, useState } from 'react'

const MOBILE_MAX = 767
const TABLET_MAX = 1023

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    const mq = window.matchMedia(query)
    const handler = () => setMatches(mq.matches)
    handler()
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [query])

  return matches
}

/** Viewport width &lt; 768px */
export function useIsMobile(): boolean {
  return useMediaQuery(`(max-width: ${MOBILE_MAX}px)`)
}

/** 768px–1024px */
export function useIsTablet(): boolean {
  return useMediaQuery(
    `(min-width: 768px) and (max-width: ${TABLET_MAX}px)`,
  )
}

/** Viewport width &gt; 1024px */
export function useIsDesktop(): boolean {
  return useMediaQuery(`(min-width: ${TABLET_MAX + 1}px)`)
}
