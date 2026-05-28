import { useState, useEffect, useCallback } from 'react'
import { login as apiLogin, signup as apiSignup, logout as apiLogout, getMe } from '../api/auth'

interface User {
  id: number
  email: string
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // On mount, check if a token exists and fetch the current user
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      setLoading(false)
      return
    }
    getMe()
      .then((me) => setUser(me))
      .catch(() => {
        // Token is invalid or expired — clear it
        localStorage.removeItem('token')
      })
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    await apiLogin(email, password)
    const me = await getMe()
    setUser(me)
  }, [])

  const signup = useCallback(async (email: string, password: string) => {
    await apiSignup(email, password)
    // Auto-login after signup
    await apiLogin(email, password)
    const me = await getMe()
    setUser(me)
  }, [])

  const logout = useCallback(() => {
    apiLogout()
    setUser(null)
  }, [])

  return { user, loading, login, signup, logout }
}
