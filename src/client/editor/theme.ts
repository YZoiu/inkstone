import { EditorView } from '@codemirror/view'
import type { Extension } from '@codemirror/state'


export const baseTheme = EditorView.theme({
  '&': { height: '100%' },
  '.cm-scroller': { fontFamily: 'inherit' },
  '.cm-content': { paddingBlock: '4px' },
  '.cm-line': { paddingInline: '16px' },
  '&.cm-focused': { outline: 'none' },
  '.cm-tooltip': { border: 'none', background: 'transparent' },
  '.cm-panels': { zIndex: '20' },
})

export function editorTheme(): Extension {
  return [baseTheme]
}
