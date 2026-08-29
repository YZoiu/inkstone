import { describe, expect, it } from 'vitest'
import { configureCodeBlockCollapsing, decorateCodeBlock, toggleCodeBlockCollapse } from '../../lib/markdown/enhance'
import { renderMarkdown } from '../../lib/markdown/renderer'
import { capturePreviewInteractionState, restorePreviewInteractionState } from './preview-state'
import { selectMarkdownTab } from './markdown-tabs'

describe('preview interaction state', () => {
  it('namespaces interactive IDs for separate preview instances', () => {
    const source = `:::: tabs\n::: tab-item One\nFirst[^note]\n:::\n::::\n\n[^note]: Footnote`
    const first = document.createElement('div')
    const second = document.createElement('div')
    first.innerHTML = renderMarkdown(source).html
    second.innerHTML = renderMarkdown(source).html

    const firstIds = new Set([...first.querySelectorAll<HTMLElement>('[id]')].map((node) => node.id))
    const secondIds = [...second.querySelectorAll<HTMLElement>('[id]')].map((node) => node.id)
    expect(secondIds.every((id) => !firstIds.has(id))).toBe(true)

    for (const root of [first, second]) {
      root.querySelectorAll<HTMLButtonElement>('[aria-controls]').forEach((button) => {
        expect(root.querySelector(`#${CSS.escape(button.getAttribute('aria-controls')!)}`)).not.toBeNull()
      })
      root.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((anchor) => {
        expect(root.querySelector(anchor.getAttribute('href')!)).not.toBeNull()
      })
    }
  })

  it('renders stable source-line keys for interactive Markdown blocks', () => {
    const rendered = renderMarkdown(`::: details Open\nBody\n:::\n\n:::: tabs\n::: tab-item One\nFirst\n:::\n::: tab-item Two\nSecond\n:::\n::::`)
    const root = document.createElement('div')
    root.innerHTML = rendered.html

    expect(root.querySelector('.markdown-details')?.hasAttribute('data-line')).toBe(true)
    expect(root.querySelector('[data-tabs]')?.hasAttribute('data-line')).toBe(true)
  })

  it('restores expanded code, details, and selected tabs after a preview rebuild', () => {
    const original = previewFixture()
    prepareCodeBlock(original)
    toggleCodeBlockCollapse(original.querySelector<HTMLButtonElement>('[data-code-collapse]')!)
    original.querySelector<HTMLDetailsElement>('details')!.open = false
    selectMarkdownTab(original.querySelectorAll<HTMLButtonElement>('[data-tab-button]')[1]!)
    const state = capturePreviewInteractionState(original)

    const rebuilt = previewFixture()
    prepareCodeBlock(rebuilt)
    restorePreviewInteractionState(rebuilt, state)

    expect(rebuilt.querySelector('.code-block')!.classList.contains('is-code-expanded')).toBe(true)
    expect(rebuilt.querySelector<HTMLDetailsElement>('details')!.open).toBe(false)
    expect(rebuilt.querySelectorAll<HTMLButtonElement>('[data-tab-button]')[1]!.getAttribute('aria-selected')).toBe('true')
    expect(rebuilt.querySelectorAll<HTMLElement>('[data-tab-panel]')[0]!.hidden).toBe(true)
  })
})

function previewFixture(): HTMLDivElement {
  const root = document.createElement('div')
  root.innerHTML = `
    <div class="code-block" data-line="4"><div class="code-block-head"><button data-copy>Copy</button></div><pre><code>1\n2\n3\n4\n5\n6\n7\n8\n9</code></pre></div>
    <details data-line="20" open><summary>More</summary><p>Body</p></details>
    <div data-tabs data-line="30"><div role="tablist"><button data-tab-button="0" aria-selected="true">A</button><button data-tab-button="1" aria-selected="false">B</button></div><section data-tab-panel="0"></section><section data-tab-panel="1" hidden></section></div>
  `
  return root
}

function prepareCodeBlock(root: HTMLElement): void {
  decorateCodeBlock(root.querySelector<HTMLElement>('.code-block')!)
  configureCodeBlockCollapsing(root, 8)
}
