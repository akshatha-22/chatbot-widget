import { useState } from 'react'
import axios from 'axios'
import { useAuth } from '../hooks/useAuth'

function describeAuthError(err: unknown, mode: 'login' | 'signup'): string {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status
    const raw = err.response?.data?.detail
    let base =
      typeof raw === 'string'
        ? raw
        : Array.isArray(raw)
          ? raw
              .map((d: { msg?: string }) => d.msg)
              .filter(Boolean)
              .join(', ')
          : ''

    if (mode === 'signup' && status === 400 && /already exists/i.test(base)) {
      return 'That email already has an account. Use Sign in below with your password.'
    }

    return base.trim() || (status === 401 ? 'Wrong email or password.' : '')
  }

  if (err instanceof Error && err.message) return err.message
  return ''
}

export default function AuthPage() {
  const { login, signup } = useAuth()
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return  // prevent duplicate submissions
    setError('')
    setLoading(true)
    const trimmedEmail = email.trim()
    try {
      isLogin
        ? await login(trimmedEmail, password)
        : await signup(trimmedEmail, password)
    } catch (err: unknown) {
      const message = describeAuthError(err, isLogin ? 'login' : 'signup')
      setError(message.trim() ? message : 'Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg border border-gray-100">

        {/* Avatar */}
        <div className="flex justify-center mb-4">
          <div
            className="w-14 h-14 rounded-full"
            style={{ background: 'radial-gradient(circle at 38% 35%, #FDE68A 0%, #FBBF24 45%, #F59E0B 75%, #D97706 100%)' }}
          />
        </div>

        <h1 className="text-2xl font-bold text-gray-800 text-center mb-1">
          {isLogin ? 'Welcome back' : 'Create account'}
        </h1>
        <p className="text-sm text-gray-400 text-center mb-6">
          {isLogin ? 'Sign in to chat with Remi' : 'Get started with Remi'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm
                         outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              minLength={6}
              required
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm
                         outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
            />
            {!isLogin && <p className="text-xs text-gray-400 mt-1">Minimum 6 characters</p>}
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2">
              <p className="text-sm text-red-500">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-indigo-500 py-2.5 text-sm font-semibold
                       text-white hover:bg-indigo-600 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Please wait...' : isLogin ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-500">
          {isLogin ? (
            <>
              New to Remi?{' '}
              <button
                type="button"
                onClick={() => {
                  setIsLogin(false)
                  setError('')
                }}
                className="text-indigo-500 font-medium hover:underline"
              >
                Create an account
              </button>
            </>
          ) : (
            <>
              Already registered?{' '}
              <button
                type="button"
                onClick={() => {
                  setIsLogin(true)
                  setError('')
                }}
                className="text-indigo-500 font-medium hover:underline"
              >
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  )
}
