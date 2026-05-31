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
    <div className="fixed bottom-[100px] right-[20px] w-[350px] rounded-2xl border border-[#F0F0F0] bg-white shadow-[0_12px_40px_rgba(0,0,0,0.12)] flex flex-col overflow-hidden z-50 animate-widgetIn origin-bottom-right">
      {/* Header — matches CompactWidget */}
      <header className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-[#F0F0F0] bg-gradient-to-b from-white to-[#FAFAFA]">
        <div className="flex items-center gap-2.5">
          <div className="leading-tight">
            <p className="text-sm font-semibold text-[#1A1A1A]">Remi</p>
            <p className="text-[11px] text-[#8C8C8C]">Your AI assistant</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-[#8C8C8C] hover:bg-[#F5F5F5] hover:text-[#1A1A1A] transition-colors"
          aria-label="Close"
        >
          <X size={16} />
        </button>
      </header>

      {/* Body */}
      <div className="px-5 py-6 bg-white">
        <div className="flex justify-center mb-4">
          <RemiAvatar2D size={48} />
        </div>
        <h2 className="text-lg font-semibold text-[#1A1A1A] text-center">
          {isLogin ? 'Welcome to Remi' : 'Create your account'} <span aria-hidden>🌟</span>
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
            className="w-full rounded-[12px] border-0 bg-[#F5F5F5] px-3.5 py-2.5 text-sm text-[#1A1A1A] placeholder:text-[#ACACAC] outline-none focus:ring-2 focus:ring-[#F59E0B]/30"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete={isLogin ? 'current-password' : 'new-password'}
            minLength={6}
            required
            className="w-full rounded-[12px] border-0 bg-[#F5F5F5] px-3.5 py-2.5 text-sm text-[#1A1A1A] placeholder:text-[#ACACAC] outline-none focus:ring-2 focus:ring-[#F59E0B]/30"
          />

          {error && (
            <div className="rounded-[12px] bg-red-50 border border-red-100 px-3 py-2">
              <p className="text-sm text-red-500">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-[12px] bg-[#F59E0B] py-2.5 text-sm font-semibold text-white hover:bg-[#D97706] active:scale-[0.98] transition-all disabled:opacity-50"
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
            className="font-semibold text-[#D97706] hover:underline"
          >
            {isLogin ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  )
}
