import ChatbotWidget from './components/ChatbotWidget/FloatingWidget'

export default function App() {
  return (
    <div style={{ minHeight: '100vh', background: '#f9f9f9' }}>
      {/* The host webpage is intentionally untouched. Remi handles its own
          auth and chat entirely inside the floating widget. */}
      <ChatbotWidget />
    </div>
  )
}
