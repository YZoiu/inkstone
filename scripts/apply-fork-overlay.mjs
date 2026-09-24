import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const HTML_GUARD_FUNCTION = [
  'function isHtmlServedAsAsset(path, response) {',
  "  if (!path.startsWith('/assets/') && !/\\\\.(js|css|woff2?)$/.test(path)) return false",
  "  return (response.headers.get('Content-Type') || '').includes('text/html')",
  '}',
].join('\n')

export function applyForkOverlay(files) {
  const warnings = []
  const next = { ...files }
  next['.nvmrc'] = applyNvmrc(files['.nvmrc'], warnings)
  for (const name of ['wrangler.toml', 'wrangler.kv.toml']) {
    next[name] = applyCrons(name, files[name], warnings)
  }
  next['src/worker/app.ts'] = applyCsp(files['src/worker/app.ts'], warnings)
  next['pwa.config.ts'] = applyPwa(files['pwa.config.ts'], warnings)
  return { files: next, warnings }
}

function applyNvmrc(text) {
  if (text != null && text.trim() === '24') return text
  return `24${text?.includes('\r\n') ? '\r\n' : '\n'}`
}

function applyCrons(name, text, warnings) {
  if (text == null) {
    warnings.push(`${name}: file is missing, left unchanged`)
    return text
  }
  const nl = newline(text)
  const note = `# One trigger covering :00/:15/:45. Workers Free allows 5 cron triggers per account.${nl}`
  let next = text.includes(note) ? text.replace(note, '') : text
  if (next.includes('crons = ["0,15,45 * * * *"]')) return next
  const upstream = 'crons = ["0 * * * *", "15,45 * * * *"]'
  if (!next.includes(upstream)) {
    warnings.push(`${name}: cron list changed upstream and was not collapsed`)
    return next
  }
  return next.replace(upstream, 'crons = ["0,15,45 * * * *"]')
}

function applyCsp(text, warnings) {
  if (text == null) {
    warnings.push('src/worker/app.ts: file is missing, left unchanged')
    return text
  }
  let next = text
  if (!next.includes("'wasm-unsafe-eval'")) {
    const anchor = "script-src 'self' 'unsafe-inline'"
    if (!next.includes(anchor)) warnings.push('src/worker/app.ts: script-src anchor not found')
    else next = next.replace(anchor, `${anchor} 'wasm-unsafe-eval' https://static.cloudflareinsights.com`)
  }
  if (!next.includes("connect-src 'self' https://cloudflareinsights.com")) {
    const anchor = "connect-src 'self'"
    if (!next.includes(anchor)) warnings.push('src/worker/app.ts: connect-src anchor not found')
    else next = next.replace(anchor, "connect-src 'self' https://cloudflareinsights.com")
  }
  return next
}

function applyPwa(text, warnings) {
  if (text == null) {
    warnings.push('pwa.config.ts: file is missing, left unchanged')
    return text
  }
  const nl = newline(text)
  let next = text
  if (next.includes("const ASSET_CACHE = 'inkstone-assets-v1'")) {
    next = next.replace("const ASSET_CACHE = 'inkstone-assets-v1'", "const ASSET_CACHE = 'inkstone-assets-v2'")
  } else if (!next.includes("const ASSET_CACHE = 'inkstone-assets-v")) {
    warnings.push('pwa.config.ts: asset cache name not found')
  }
  if (!next.includes("key.startsWith('inkstone-assets-') && key !== ASSET_CACHE")) {
    next = replaceOnce(
      next,
      ".filter((key) => key.startsWith('inkstone-shell-') && key !== SHELL_CACHE)",
      [
        '.filter((key) =>',
        "        (key.startsWith('inkstone-shell-') && key !== SHELL_CACHE) ||",
        "        (key.startsWith('inkstone-assets-') && key !== ASSET_CACHE))",
      ].join(nl),
      warnings,
      'pwa.config.ts: activate cache filter not found',
    )
  }
  next = replaceOnce(
    next,
    'if (cached) return cached',
    'if (cached && !isHtmlServedAsAsset(url.pathname, cached)) return cached',
    warnings,
    'pwa.config.ts: cached asset return not found',
    (value) => value.includes('isHtmlServedAsAsset(url.pathname, cached)'),
  )
  next = replaceOnce(
    next,
    'if (response.ok && OPTIONAL_URL_SET.has(url.pathname)) {',
    'if (response.ok && OPTIONAL_URL_SET.has(url.pathname) && !isHtmlServedAsAsset(url.pathname, response)) {',
    warnings,
    'pwa.config.ts: optional cache write not found',
    (value) => value.includes('isHtmlServedAsAsset(url.pathname, response)'),
  )
  const fetchAnchor = "if (!response.ok) throw new Error('Failed to cache ' + url + ': HTTP ' + response.status)"
  if (!next.includes('HTML fallback')) {
    next = replaceOnce(
      next,
      fetchAnchor,
      [
        fetchAnchor,
        '  if (isHtmlServedAsAsset(url, response)) {',
        "    throw new Error('Failed to cache ' + url + ': HTML fallback')",
        '  }',
      ].join(nl),
      warnings,
      'pwa.config.ts: fetchRequired status check not found',
    )
  }
  if (!next.includes('function isHtmlServedAsAsset(')) {
    const anchor = 'function isImmutableAsset(url) {'
    next = replaceOnce(
      next,
      anchor,
      `${HTML_GUARD_FUNCTION.replaceAll('\n', nl)}${nl}${nl}${anchor}`,
      warnings,
      'pwa.config.ts: isImmutableAsset anchor not found',
    )
  }
  return next
}

function replaceOnce(text, from, to, warnings, message, already) {
  if (already?.(text)) return text
  const found = text.split(from).length - 1
  if (found !== 1) {
    warnings.push(message)
    return text
  }
  return text.replace(from, to)
}

function newline(text) {
  return text.includes('\r\n') ? '\r\n' : '\n'
}

function read(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null
}

function ranAsCli() {
  const entry = process.argv[1]
  if (!entry) return false
  return import.meta.url === pathToFileURL(path.resolve(entry)).href
}

if (ranAsCli()) {
  const paths = ['.nvmrc', 'wrangler.toml', 'wrangler.kv.toml', 'src/worker/app.ts', 'pwa.config.ts']
  const current = Object.fromEntries(paths.map((file) => [file, read(file)]))
  const { files, warnings } = applyForkOverlay(current)
  for (const file of paths) {
    if (files[file] != null && files[file] !== current[file]) fs.writeFileSync(file, files[file])
  }
  for (const warning of warnings) {
    if (process.env.GITHUB_ACTIONS) console.log(`::warning::${warning}`)
    else console.warn(warning)
  }
  if (process.env.GITHUB_STEP_SUMMARY && warnings.length) {
    fs.appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `### Fork overlay warnings\n\n${warnings.map((warning) => `- ${warning}`).join('\n')}\n`,
    )
  }
}
