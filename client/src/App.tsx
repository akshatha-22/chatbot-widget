import { useAuth } from './hooks/useAuth'
import AuthPage from './components/AuthPage'
import ChatbotWidget from './components/ChatbotWidget/FloatingWidget'

export default function App() {
  const { user, loading, logout } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-gray-400">
        Loading...
      </div>
    )
  }

  if (!user) {
    return <AuthPage />
  }

  return (
    <>
      <div className="flex h-screen items-center justify-center bg-[#F3F4F6]">
        <div className="text-center">
          <p className="text-gray-500 text-sm mb-2">Signed in as {user.email}</p>
          <p className="text-gray-400 text-sm">Click the chat button to open Remi</p>
          <button
            type="button"
            onClick={logout}
            className="mt-4 text-xs text-gray-400 hover:text-gray-600 underline"
          >
            Sign out
          </button>
        </div>
      </div>
      <ChatbotWidget />
    </>
  )
}
