import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS, mergeSettingsPatch } from '@shared/constants'
import { initI18n } from '../lib/i18n'
import { syncAppearanceToDom } from './session'
import { useUi } from './ui'

beforeEach(async () => {
  vi.stubGlobal('matchMedia', () => ({ matches: false }))
  await initI18n()
  syncAppearanceToDom(DEFAULT_SETTINGS)
})

afterEach(() => vi.unstubAllGlobals())

describe('appearance synchronization', () => {
  it('does not rewrite the document or notify UI subscribers for unchanged appearance', () => {
    const observer = new MutationObserver(() => {})
    observer.observe(document.documentElement, { attributes: true, subtree: true, childList: true })
    const changed = vi.fn()
    const unsubscribe = useUi.subscribe(changed)
    try {
      syncAppearanceToDom(DEFAULT_SETTINGS)
      syncAppearanceToDom(mergeSettingsPatch(DEFAULT_SETTINGS, {
        editor: { spellcheck: !DEFAULT_SETTINGS.editor.spellcheck },
      }))
      expect(observer.takeRecords()).toHaveLength(0)
      expect(changed).not.toHaveBeenCalled()
    } finally {
      unsubscribe()
      observer.disconnect()
    }
  })

  it('applies changed typography immediately without rewriting unrelated root attributes', () => {
    const observer = new MutationObserver(() => {})
    observer.observe(document.documentElement, { attributes: true })
    try {
      syncAppearanceToDom(mergeSettingsPatch(DEFAULT_SETTINGS, { appearance: { proseSize: 20 } }))
      expect(document.documentElement.style.getPropertyValue('--prose-size')).toBe('20px')
      expect(observer.takeRecords().map((record) => record.attributeName)).toEqual(['style'])
    } finally {
      observer.disconnect()
    }
  })
})
