import { useState, useCallback } from 'react'

interface WidgetState {
  isOpen: boolean
  isLoading: boolean
  error: string | null
}

/**
 * useWidget Hook
 * Manages widget state and lifecycle
 */
export const useWidget = () => {
  const [state, setState] = useState<WidgetState>({
    isOpen: false,
    isLoading: false,
    error: null,
  })

  const open = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: true }))
  }, [])

  const close = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: false }))
  }, [])

  const toggle = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: !prev.isOpen }))
  }, [])

  const setLoading = useCallback((loading: boolean) => {
    setState((prev) => ({ ...prev, isLoading: loading }))
  }, [])

  const setError = useCallback((error: string | null) => {
    setState((prev) => ({ ...prev, error }))
  }, [])

  return {
    ...state,
    open,
    close,
    toggle,
    setLoading,
    setError,
  }
}
