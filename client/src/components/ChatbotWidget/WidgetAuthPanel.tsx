import { useState } from 'react'
import axios from 'axios'
import { X } from 'lucide-react'
import { login as apiLogin, signup as apiSignup, getMe } from '../../api/auth'
import type { User } from '../../types'
import RemiAvatar2D from './RemiAvatar2D'

type WidgetAuthPanelProps = {
  onSuccess: (user: User) => void
  onClose: () => void
}

function describeAuthError(err: unknown, mode: 'login' | 'signup'): string {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status
    const raw = err.response?.data?.detail
    const base =
      typeof raw === 'string'
        ? raw
        : Array.isArray(raw)
          ? raw
              .map((d: { msg?: string }) => d.msg)
              .filter(Boolean)
              .join(', ')
          : ''

    if (mode === 'signup' && status === 400 && /already exists/i.test(base)) {
      return 'That email already has an account. Use Sign in with your password.'
    }

    return base.trim() || (status === 401 ? 'Wrong email or password.' : '')
  }

  if (err instanceof Error && err.message) return err.message
  return ''
}

export default function WidgetAuthPanel({ onSuccess, onClose }: WidgetAuthPanelProps) {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    setError('')
    setLoading(true)
    const trimmedEmail = email.trim()
    try {
      if (!isLogin) {
        await apiSignup(trimmedEmail, password)
      }
      // login stores the token; works for both fresh signup and returning users
      await apiLogin(trimmedEmail, password)
      const me = await getMe()
      onSuccess(me)
    } catch (err: unknown) {
      const message = describeAuthError(err, isLogin ? 'login' : 'signup')
      setError(message.trim() ? message : 'Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed z-50 flex flex-col overflow-hidden border border-[#F0F0F0] bg-white shadow-[0_12px_40px_rgba(0,0,0,0.12)] animate-widgetIn max-md:inset-0 max-md:rounded-none max-md:origin-center md:bottom-[100px] md:right-[20px] md:w-[350px] md:max-w-[calc(100vw-2rem)] md:rounded-2xl md:origin-bottom-right">
      {/* Header — matches CompactWidget */}
      <header className="flex shrink-0 items-center justify-between border-b border-[#F0F0F0] bg-gradient-to-b from-white to-[#FAFAFA] px-4 py-3 max-md:pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-2.5">
          <RemiAvatar2D size={28} className="shrink-0 md:hidden" />
          <div className="leading-tight">
            <p className="text-sm font-semibold text-[#1A1A1A]">Remi</p>
            <p className="text-[11px] text-[#8C8C8C]">Your AI assistant</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-[#8C8C8C] active:bg-[#F5F5F5] md:p-1.5 md:hover:bg-[#F5F5F5] md:hover:text-[#1A1A1A]"
          aria-label="Close"
        >
          <X size={18} />
        </button>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto overscroll-contain bg-white px-5 py-6 max-md:px-4 max-md:pb-[max(1.5rem,env(safe-area-inset-bottom))] touch-scroll">
        <div className="flex justify-center mb-4">
          <RemiAvatar2D size={48} />
        </div>
        <h2 className="text-lg font-semibold text-[#1A1A1A] text-center">
          {isLogin ? 'Welcome to Remi' : 'Create your account'}
        </h2>
        <p className="mt-1 text-sm text-[#8C8C8C] text-center">
          {isLogin ? 'Sign in to start chatting' : 'Sign up to start chatting'}
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
            className="w-full rounded-[12px] border-0 bg-[#F5F5F5] px-3.5 py-3 text-base text-[#1A1A1A] placeholder:text-[#ACACAC] outline-none focus:ring-2 focus:ring-[#F59E0B]/30 md:py-2.5 md:text-sm"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete={isLogin ? 'current-password' : 'new-password'}
            minLength={6}
            required
            className="w-full rounded-[12px] border-0 bg-[#F5F5F5] px-3.5 py-3 text-base text-[#1A1A1A] placeholder:text-[#ACACAC] outline-none focus:ring-2 focus:ring-[#F59E0B]/30 md:py-2.5 md:text-sm"
          />

          {error && (
            <div className="rounded-[12px] bg-red-50 border border-red-100 px-3 py-2">
              <p className="text-sm text-red-500">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="min-h-[44px] w-full rounded-[12px] bg-[#F59E0B] py-3 text-sm font-semibold text-white active:scale-[0.98] disabled:opacity-50 md:py-2.5 md:hover:bg-[#D97706]"
          >
            {loading ? 'Please wait…' : isLogin ? 'Sign in' : 'Sign up'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-[#8C8C8C]">
          {isLogin ? "Don't have an account? " : 'Already have an account? '}
          <button
            type="button"
            onClick={() => {
              setIsLogin((prev) => !prev)
              setError('')
            }}
            className="inline-flex min-h-[44px] items-center font-semibold text-[#D97706] active:opacity-80 md:hover:underline"
          >
            {isLogin ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  )
}
