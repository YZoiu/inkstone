import { beforeAll, describe, expect, it } from 'vitest'
import { initI18n } from '../i18n'
import { configureCodeBlockCollapsing, decorateCodeBlock, enhancePreview, toggleCodeBlockCollapse } from './enhance'
import { highlightWithPrism } from './prism'

beforeAll(async () => {
  await initI18n()
})

describe('code block collapsing', () => {
  it('loads every configured Prism language on demand', async () => {
    const languages = [
      'html', 'xml', 'css', 'javascript', 'typescript', 'jsx', 'tsx', 'json', 'markdown',
      'bash', 'powershell', 'python', 'java', 'c', 'c++', 'c#', 'go', 'rust', 'php', 'ruby',
      'sql', 'yaml', 'toml', 'dockerfile', 'nginx', 'diff', 'http', 'graphql', 'scss', 'less',
    ]

    const results = await Promise.all(languages.map((language) => highlightWithPrism('const value = 1', language)))

    expect(results.every(Boolean)).toBe(true)
  })

  it('highlights supported languages with Prism while preserving line wrappers', async () => {
    const root = document.createElement('div')
    root.innerHTML = '<div class="code-block" data-lang="tsx"><div class="code-block-head"><span class="code-title">tsx</span><button data-copy type="button">Copy</button></div><pre><code>const App = () =&gt; (\n  &lt;main&gt;Hello&lt;/main&gt;\n)</code></pre></div>'

    await enhancePreview(root, { math: false, mermaid: false, dark: false, codeBlockCollapseLines: 8 })

    expect(root.querySelector('code')!.classList.contains('language-tsx')).toBe(true)
    expect(root.querySelector('.token.keyword')?.textContent).toBe('const')
    expect(root.querySelector('.token.tag')?.textContent).toContain('main')
    const lines = [...root.querySelectorAll<HTMLElement>('.line')]
    expect(lines).toHaveLength(3)
    expect(lines.map((line) => line.textContent).join('\n')).toBe('const App = () => (\n  <main>Hello</main>\n)')
  })

  it('leaves unknown languages as plain text without throwing', async () => {
    const root = document.createElement('div')
    root.innerHTML = '<div class="code-block" data-lang="not-a-language"><pre><code>&lt;plain&gt;\ntext</code></pre></div>'

    await expect(enhancePreview(root, { math: false, mermaid: false, dark: false })).resolves.toBeUndefined()

    expect(root.querySelector('.token')).toBeNull()
    expect(root.querySelectorAll('.line')).toHaveLength(2)
    expect(root.querySelector('code')!.textContent).toBe('<plain>\ntext')
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
