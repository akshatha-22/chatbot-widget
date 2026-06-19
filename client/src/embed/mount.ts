import type { Root } from 'react-dom/client'
import type { WidgetPosition } from '../utils/widgetPosition'
import { setApiBaseUrl } from '../api/config'

export type RemiEmbedConfig = {
  apiUrl?: string
  primaryColor?: string
  position?: WidgetPosition
  containerId?: string
}

export type RemiEmbedController = {
  mount: (config?: RemiEmbedConfig) => void
  unmount: () => void
  isMounted: () => boolean
}

function resolveApiUrl(config: RemiEmbedConfig): string | undefined {
  return config.apiUrl?.trim() || undefined
}

export function createRemiEmbedController(
  renderWidget: (container: HTMLElement, config: RemiEmbedConfig) => Root,
): RemiEmbedController {
  let root: Root | null = null
  let container: HTMLDivElement | null = null

  function mount(config: RemiEmbedConfig = {}) {
    if (container) {
      console.warn('[Remi] Widget already mounted — call unmount() first')
      return
    }

    const apiUrl = resolveApiUrl(config)
    if (!apiUrl) {
      console.error('[Remi] apiUrl is required — set window.RemiConfig.apiUrl or pass mount({ apiUrl })')
      return
    }
    setApiBaseUrl(apiUrl)

    container = document.createElement('div')
    container.id = config.containerId || 'remi-widget-mount'
    container.className = 'remi-widget-mount'
    container.style.cssText = 'position:fixed;z-index:999999;inset:0;pointer-events:none;'
    const inner = document.createElement('div')
    inner.className = 'remi-widget-mount-inner'
    inner.style.cssText = 'pointer-events:auto;'
    container.appendChild(inner)
    document.body.appendChild(container)

    root = renderWidget(inner, {
      ...config,
      apiUrl,
      position: config.position ?? 'bottom-right',
      primaryColor: config.primaryColor ?? '#2979FF',
    })
  }

  function unmount() {
    if (root) {
      root.unmount()
      root = null
    }
    if (container) {
      container.remove()
      container = null
    }
  }

  return {
    mount,
    unmount,
    isMounted: () => container !== null,
  }
}

export function shouldAutoMount(scriptTag: HTMLScriptElement | null): boolean {
  return scriptTag?.dataset?.manualMount !== 'true'
}

export function scheduleAutoMount(
  mountFn: () => void,
  readyState: DocumentReadyState = document.readyState,
): void {
  if (readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountFn, { once: true })
  } else {
    mountFn()
  }
}
