import React from 'react'
import { createRoot } from 'react-dom/client'
import ChatbotWidgetRoot from './components/ChatbotWidget'
import {
  createRemiEmbedController,
  scheduleAutoMount,
  shouldAutoMount,
  type RemiEmbedConfig,
} from './embed/mount'
import './styles/embed.css'

declare global {
  interface Window {
    RemiConfig?: RemiEmbedConfig
    RemiWidget?: ReturnType<typeof createRemiEmbedController>
  }
}

const controller = createRemiEmbedController((container, config) => {
  const root = createRoot(container)
  root.render(
    <React.StrictMode>
      <ChatbotWidgetRoot
        apiUrl={config.apiUrl}
        primaryColor={config.primaryColor}
        position={config.position}
      />
    </React.StrictMode>,
  )
  return root
})

window.RemiWidget = controller

function autoMount() {
  const scriptTag = document.currentScript as HTMLScriptElement | null
  if (!shouldAutoMount(scriptTag)) {
    return
  }
  controller.mount(window.RemiConfig ?? {})
}

scheduleAutoMount(autoMount)

export { controller as RemiWidget }
