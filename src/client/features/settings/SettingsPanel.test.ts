import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { initI18n, t } from '../../lib/i18n'
import { SettingsPanel } from './SettingsPanel'
import { settingsLoaders } from './sections'

vi.mock('./AccountSettings', () => new Promise(() => {}))
vi.mock('./EditorSettings', () => ({
  EditorSettings: () => createElement('input', { 'aria-label': 'Draft', defaultValue: '' }),
}))
vi.mock('./sections', async (original) => ({
  ...await original<typeof import('./sections')>(),
  scheduleSettingsWarmup: () => () => {},
  warmSettingsSection: vi.fn(),
}))

let root: Root
let container: HTMLDivElement
const originalScrollTo = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollTo')

beforeEach(async () => {
  localStorage.clear()
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('matchMedia', () => ({ matches: false }))
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: vi.fn() })
  await initI18n()
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  if (root) await act(() => root.unmount())
  container?.remove()
  if (originalScrollTo) Object.defineProperty(HTMLElement.prototype, 'scrollTo', originalScrollTo)
  else Reflect.deleteProperty(HTMLElement.prototype, 'scrollTo')
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('settings panel responsiveness', () => {
  it('retries a failed section without reloading the application', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(settingsLoaders, 'sync')
      .mockRejectedValueOnce(new Error('Chunk unavailable'))
      .mockResolvedValue({ default: () => createElement('p', null, 'Recovered section') })
    await act(() => root.render(createElement(SettingsPanel, { onClose: vi.fn() })))
    const button = [...document.querySelectorAll('nav button')].find((node) => node.textContent === t('settings.sync'))!
    await act(async () => {
      (button as HTMLButtonElement).click()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    const error = document.querySelector('[role="alert"]')!
    expect(error).not.toBeNull()
    await act(async () => {
      error.querySelector('button')!.click()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(document.querySelector('[role="alert"]')).toBeNull()
    expect(document.body.textContent).toContain('Recovered section')
  })
  it('opens immediately and keeps navigation and dismissal usable while a section is loading', async () => {
    const onClose = vi.fn()
    await act(() => root.render(createElement(SettingsPanel, { onClose })))
    const dialog = document.querySelector('[role="dialog"]')!
    expect(dialog).not.toBeNull()
    expect(dialog.textContent).toContain(t('settings.interface_language'))

    const select = async (label: string) => {
      const button = [...dialog.querySelectorAll('nav button')].find((node) => node.textContent === label)!
      await act(() => (button as HTMLButtonElement).click())
    }
    await select(t('settings.account'))
    expect(dialog.querySelector('[role="status"]')).not.toBeNull()
    expect(dialog.querySelector('[aria-current="page"]')?.textContent).toBe(t('settings.account'))

    await select(t('settings.appearance'))
    expect(dialog.querySelector('[aria-hidden="false"] [role="status"]')).toBeNull()
    expect(dialog.textContent).toContain(t('settings.interface_language'))

    await select(t('settings.account'))
    const close = dialog.querySelector<HTMLButtonElement>(`button[aria-label="${t('common.close')}"]`)!
    await act(() => close.click())
    expect(onClose).toHaveBeenCalledOnce()
    await act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })))
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('retains visited content, drafts and scroll position and remembers the last section after reopening', async () => {
    const onClose = vi.fn()
    await act(() => root.render(createElement(SettingsPanel, { onClose })))
    const select = async (label: string) => {
      const button = [...document.querySelectorAll('nav button')].find((node) => node.textContent === label)!
      await act(async () => {
        (button as HTMLButtonElement).click()
        await new Promise((resolve) => setTimeout(resolve, 0))
      })
    }
    await select(t('settings.editor'))
    const input = document.querySelector<HTMLInputElement>('[aria-label="Draft"]')!
    expect(input).not.toBeNull()
    input.value = 'Unsaved draft'
    const body = input.closest<HTMLDivElement>('[aria-hidden="false"]')!
    body.scrollTop = 140
    await select(t('settings.appearance'))
    expect(body.hidden).toBe(true)
    expect(body.hasAttribute('inert')).toBe(true)
    await select(t('settings.editor'))
    expect(document.querySelector('[aria-label="Draft"]')).toBe(input)
    expect(input.value).toBe('Unsaved draft')
    expect(body.scrollTop).toBe(140)

    await act(() => root.render(null))
    await act(() => root.render(createElement(SettingsPanel, { onClose })))
    expect(document.querySelector('[aria-current="page"]')?.textContent).toBe(t('settings.editor'))
    expect(document.querySelector<HTMLInputElement>('[aria-label="Draft"]')?.value).toBe('')
  })
})
