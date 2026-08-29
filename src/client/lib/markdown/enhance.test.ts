import { describe, expect, it } from 'vitest'
import { configureCodeBlockCollapsing, decorateCodeBlock, enhancePreview, toggleCodeBlockCollapse } from './enhance'

describe('code block collapsing', () => {
  it('keeps Shiki syntax highlighting when collapsing a TypeScript block', async () => {
    const root = document.createElement('div')
    root.innerHTML = '<div class="code-block" data-lang="typescript"><div class="code-block-head"><span class="code-title">typescript</span><button data-copy type="button">Copy</button></div><pre class="shiki-pending"><code>const answer: number = 42</code></pre></div>'

    await enhancePreview(root, { math: false, mermaid: false, dark: false, codeBlockCollapseLines: 8 })

    expect(root.querySelector('pre')!.classList.contains('shiki')).toBe(true)
    const tokens = [...root.querySelectorAll<HTMLElement>('.line span')]
    expect(tokens.length).toBeGreaterThan(1)
    expect(tokens[0]!.style.color).not.toBe('')
    expect(tokens[0]!.style.color).not.toBe(tokens[1]!.style.color)
    expect(tokens[0]!.style.getPropertyValue('--shiki-dark')).not.toBe('')
  })

  it('collapses long blocks and restores their full height when expanded', () => {
    const root = document.createElement('div')
    root.innerHTML = '<div class="code-block"><div class="code-block-head"><span class="code-title">text</span><button data-copy type="button">Copy</button></div><pre><code>1\n2\n3\n4\n5\n6\n7\n8\n9\n10</code></pre></div>'
    const block = root.querySelector<HTMLElement>('.code-block')!

    decorateCodeBlock(block)
    configureCodeBlockCollapsing(root, 8)

    const toggle = block.querySelector<HTMLButtonElement>('[data-code-collapse]')!
    expect(block.classList.contains('is-code-collapsed')).toBe(true)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(toggle.getAttribute('aria-controls')).toBe(block.querySelector('pre')!.id)
    expect(toggle.textContent).toContain('2')

    toggleCodeBlockCollapse(toggle)
    expect(block.classList.contains('is-code-expanded')).toBe(true)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(block.querySelector('pre')!.style.maxHeight).toBe('')

    configureCodeBlockCollapsing(root, 8)
    expect(block.classList.contains('is-code-expanded')).toBe(true)
    expect(block.querySelector<HTMLButtonElement>('[data-code-collapse]')!.getAttribute('aria-expanded')).toBe('true')
  })

  it('shows readable math source when math rendering is disabled', async () => {
    const root = document.createElement('div')
    root.innerHTML = '<p>Value: <span class="math-inline" data-math="x^2"></span></p><div class="math-block" data-math="a+b"></div>'

    await enhancePreview(root, { math: false, mermaid: false, dark: false })

    expect(root.querySelector('.math-inline')!.textContent).toBe('$x^2$')
    expect(root.querySelector('.math-block')!.textContent).toBe('$$\na+b\n$$')
    expect(root.querySelectorAll('.math-source')).toHaveLength(2)
  })
})
