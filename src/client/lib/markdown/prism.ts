import Prism from 'prismjs/components/prism-core'

type Language =
  | 'markup'
  | 'css'
  | 'javascript'
  | 'typescript'
  | 'jsx'
  | 'tsx'
  | 'json'
  | 'markdown'
  | 'bash'
  | 'powershell'
  | 'python'
  | 'java'
  | 'c'
  | 'cpp'
  | 'csharp'
  | 'go'
  | 'rust'
  | 'php'
  | 'ruby'
  | 'sql'
  | 'yaml'
  | 'toml'
  | 'docker'
  | 'nginx'
  | 'diff'
  | 'http'
  | 'graphql'
  | 'scss'
  | 'less'

const aliases: Record<string, Language> = {
  html: 'markup',
  xml: 'markup',
  svg: 'markup',
  mathml: 'markup',
  markup: 'markup',
  css: 'css',
  js: 'javascript',
  javascript: 'javascript',
  ts: 'typescript',
  typescript: 'typescript',
  jsx: 'jsx',
  tsx: 'tsx',
  json: 'json',
  webmanifest: 'json',
  md: 'markdown',
  markdown: 'markdown',
  bash: 'bash',
  shell: 'bash',
  sh: 'bash',
  zsh: 'bash',
  powershell: 'powershell',
  ps1: 'powershell',
  python: 'python',
  py: 'python',
  java: 'java',
  c: 'c',
  cpp: 'cpp',
  'c++': 'cpp',
  csharp: 'csharp',
  cs: 'csharp',
  'c#': 'csharp',
  dotnet: 'csharp',
  go: 'go',
  golang: 'go',
  rust: 'rust',
  rs: 'rust',
  php: 'php',
  ruby: 'ruby',
  rb: 'ruby',
  sql: 'sql',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'toml',
  docker: 'docker',
  dockerfile: 'docker',
  nginx: 'nginx',
  diff: 'diff',
  patch: 'diff',
  http: 'http',
  graphql: 'graphql',
  gql: 'graphql',
  scss: 'scss',
  less: 'less',
}

const componentImports: Record<string, () => Promise<unknown>> = {
  markup: () => import('prismjs/components/prism-markup'),
  css: () => import('prismjs/components/prism-css'),
  clike: () => import('prismjs/components/prism-clike'),
  javascript: () => import('prismjs/components/prism-javascript'),
  typescript: () => import('prismjs/components/prism-typescript'),
  jsx: () => import('prismjs/components/prism-jsx'),
  tsx: () => import('prismjs/components/prism-tsx'),
  json: () => import('prismjs/components/prism-json'),
  markdown: () => import('prismjs/components/prism-markdown'),
  bash: () => import('prismjs/components/prism-bash'),
  powershell: () => import('prismjs/components/prism-powershell'),
  python: () => import('prismjs/components/prism-python'),
  java: () => import('prismjs/components/prism-java'),
  c: () => import('prismjs/components/prism-c'),
  cpp: () => import('prismjs/components/prism-cpp'),
  csharp: () => import('prismjs/components/prism-csharp'),
  go: () => import('prismjs/components/prism-go'),
  rust: () => import('prismjs/components/prism-rust'),
  'markup-templating': () => import('prismjs/components/prism-markup-templating'),
  php: () => import('prismjs/components/prism-php'),
  ruby: () => import('prismjs/components/prism-ruby'),
  sql: () => import('prismjs/components/prism-sql'),
  yaml: () => import('prismjs/components/prism-yaml'),
  toml: () => import('prismjs/components/prism-toml'),
  docker: () => import('prismjs/components/prism-docker'),
  nginx: () => import('prismjs/components/prism-nginx'),
  diff: () => import('prismjs/components/prism-diff'),
  http: () => import('prismjs/components/prism-http'),
  graphql: () => import('prismjs/components/prism-graphql'),
  scss: () => import('prismjs/components/prism-scss'),
  less: () => import('prismjs/components/prism-less'),
}

const loading = new Map<string, Promise<void>>()

export async function highlightWithPrism(source: string, language: string): Promise<{ html: string; language: Language } | null> {
  const canonical = aliases[language.trim().toLowerCase()]
  if (!canonical) return null

  await loadLanguage(canonical)
  const grammar = Prism.languages[canonical]
  if (!grammar) return null
  return { html: Prism.highlight(source, grammar, canonical), language: canonical }
}

function loadLanguage(language: string): Promise<void> {
  if (Prism.languages[language]) return Promise.resolve()
  const pending = loading.get(language)
  if (pending) return pending

  const next = (async () => {
    for (const dependency of dependencies(language)) await loadLanguage(dependency)
    await componentImports[language]?.()
    if (!Prism.languages[language]) throw new Error(`Prism language failed to load: ${language}`)
  })()
  loading.set(language, next)
  void next.catch(() => loading.delete(language))
  return next
}

function dependencies(language: string): string[] {
  switch (language) {
    case 'css': return ['markup']
    case 'javascript': return ['markup', 'clike']
    case 'typescript': return ['javascript']
    case 'jsx': return ['markup', 'javascript']
    case 'tsx': return ['jsx', 'typescript']
    case 'markdown': return ['markup', 'yaml']
    case 'java':
    case 'c':
    case 'csharp':
    case 'go':
    case 'ruby': return ['clike']
    case 'cpp': return ['c']
    case 'markup-templating': return ['markup']
    case 'php': return ['markup-templating']
    case 'http': return ['markup', 'css', 'javascript', 'json']
    case 'graphql': return ['markdown']
    case 'scss':
    case 'less': return ['css']
    default: return []
  }
}
