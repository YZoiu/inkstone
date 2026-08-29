import { toggleCodeBlockCollapse } from '../../lib/markdown/enhance'
import { selectMarkdownTab } from './markdown-tabs'

export interface PreviewInteractionState {
  codeBlocks: Map<string, boolean>
  details: Map<string, boolean>
  tabs: Map<string, string>
}

export function capturePreviewInteractionState(root: HTMLElement | null): PreviewInteractionState {
  const state: PreviewInteractionState = {
    codeBlocks: new Map(),
    details: new Map(),
    tabs: new Map(),
  }
  if (!root) return state

  keyedElements(root, '.code-block[data-line]').forEach(([key, element]) => {
    state.codeBlocks.set(key, element.classList.contains('is-code-expanded'))
  })
  keyedElements(root, 'details[data-line]').forEach(([key, element]) => {
    state.details.set(key, (element as HTMLDetailsElement).open)
  })
  keyedElements(root, '[data-tabs][data-line]').forEach(([key, element]) => {
    const selected = element.querySelector<HTMLElement>('[data-tab-button][aria-selected="true"]')
    if (selected?.dataset.tabButton !== undefined) state.tabs.set(key, selected.dataset.tabButton)
  })
  return state
}

export function restorePreviewInteractionState(
  root: HTMLElement,
  state: PreviewInteractionState,
): void {
  keyedElements(root, '.code-block[data-line]').forEach(([key, element]) => {
    if (!state.codeBlocks.get(key) || element.classList.contains('is-code-expanded')) return
    const button = element.querySelector<HTMLButtonElement>('[data-code-collapse]')
    if (button) toggleCodeBlockCollapse(button)
  })
  keyedElements(root, 'details[data-line]').forEach(([key, element]) => {
    const open = state.details.get(key)
    if (open !== undefined) (element as HTMLDetailsElement).open = open
  })
  keyedElements(root, '[data-tabs][data-line]').forEach(([key, element]) => {
    const selected = state.tabs.get(key)
    if (selected === undefined) return
    const button = [...element.querySelectorAll<HTMLButtonElement>('[data-tab-button]')]
      .find((candidate) => candidate.dataset.tabButton === selected)
    if (button) selectMarkdownTab(button)
  })
}

function keyedElements(root: HTMLElement, selector: string): Array<[string, HTMLElement]> {
  const occurrences = new Map<string, number>()
  return [...root.querySelectorAll<HTMLElement>(selector)].map((element) => {
    const line = element.dataset.line ?? 'unmapped'
    const occurrence = occurrences.get(line) ?? 0
    occurrences.set(line, occurrence + 1)
    return [`${line}:${occurrence}`, element]
  })
}
