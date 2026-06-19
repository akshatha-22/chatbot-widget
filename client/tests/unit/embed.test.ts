import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  createRemiEmbedController,
  scheduleAutoMount,
  shouldAutoMount,
} from '../../src/embed/mount'
import { getApiBaseUrl, setApiBaseUrl } from '../../src/api/config'

describe('createRemiEmbedController', () => {
  beforeEach(() => {
    setApiBaseUrl('http://localhost:8000')
    document.body.innerHTML = ''
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('mount() creates a container and appends to document.body', () => {
    const renderWidget = vi.fn(() => ({ unmount: vi.fn() }))
    const controller = createRemiEmbedController(renderWidget)

    controller.mount({ apiUrl: 'https://api.example.com' })

    expect(document.body.querySelector('#remi-widget-mount')).not.toBeNull()
    expect(renderWidget).toHaveBeenCalledOnce()
    expect(getApiBaseUrl()).toBe('https://api.example.com')
  })

  it('mount() called twice warns and does not duplicate', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const renderWidget = vi.fn(() => ({ unmount: vi.fn() }))
    const controller = createRemiEmbedController(renderWidget)

    controller.mount({ apiUrl: 'https://api.example.com' })
    controller.mount({ apiUrl: 'https://api.example.com' })

    expect(document.querySelectorAll('#remi-widget-mount')).toHaveLength(1)
    expect(renderWidget).toHaveBeenCalledOnce()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('unmount() removes container and unmounts React root', () => {
    const rootUnmount = vi.fn()
    const renderWidget = vi.fn(() => ({ unmount: rootUnmount }))
    const controller = createRemiEmbedController(renderWidget)

    controller.mount({ apiUrl: 'https://api.example.com' })
    expect(controller.isMounted()).toBe(true)

    controller.unmount()

    expect(rootUnmount).toHaveBeenCalledOnce()
    expect(document.querySelector('#remi-widget-mount')).toBeNull()
    expect(controller.isMounted()).toBe(false)
  })

  it('mount() without apiUrl logs error and does not mount', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const renderWidget = vi.fn(() => ({ unmount: vi.fn() }))
    const controller = createRemiEmbedController(renderWidget)

    controller.mount({})

    expect(renderWidget).not.toHaveBeenCalled()
    expect(document.body.children).toHaveLength(0)
    error.mockRestore()
  })

  it('passes apiUrl from config to renderWidget', () => {
    const renderWidget = vi.fn(() => ({ unmount: vi.fn() }))
    const controller = createRemiEmbedController(renderWidget)

    controller.mount({
      apiUrl: 'https://railway.example.app',
      primaryColor: '#ff0000',
      position: 'bottom-left',
    })

    expect(renderWidget).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({
        apiUrl: 'https://railway.example.app',
        primaryColor: '#ff0000',
        position: 'bottom-left',
      }),
    )
  })
})

describe('shouldAutoMount', () => {
  it('returns false when data-manual-mount is true', () => {
    const script = document.createElement('script')
    script.dataset.manualMount = 'true'
    expect(shouldAutoMount(script)).toBe(false)
  })

  it('returns true when manual mount not set', () => {
    const script = document.createElement('script')
    expect(shouldAutoMount(script)).toBe(true)
  })
})

describe('scheduleAutoMount', () => {
  it('calls mount immediately when document is already loaded', () => {
    const fn = vi.fn()
    scheduleAutoMount(fn, 'complete')
    expect(fn).toHaveBeenCalledOnce()
  })

  it('waits for DOMContentLoaded when loading', () => {
    const fn = vi.fn()
    scheduleAutoMount(fn, 'loading')
    expect(fn).not.toHaveBeenCalled()
    document.dispatchEvent(new Event('DOMContentLoaded'))
    expect(fn).toHaveBeenCalledOnce()
  })
})
