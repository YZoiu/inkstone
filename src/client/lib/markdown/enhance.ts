


import { decodeDataValue } from './data-attr';
import { t } from "../i18n";

type Highlighter = {
    codeToHtml: (code: string, options: Record<string, unknown>) => string;
    getBundledLanguages: () => Record<string, unknown>;
    getLoadedLanguages: () => string[];
    loadLanguage: (lang: unknown) => Promise<void>;
};
const OPTIONAL_RENDERER_LOAD_TIMEOUT_MS = 15000;


const SHIKI_LANGUAGES = {
    bash: () => import('@shikijs/langs/bash'),
    c: () => import('@shikijs/langs/c'),
    cpp: () => import('@shikijs/langs/cpp'),
    csharp: () => import('@shikijs/langs/csharp'),
    css: () => import('@shikijs/langs/css'),
    dart: () => import('@shikijs/langs/dart'),
    diff: () => import('@shikijs/langs/diff'),
    docker: () => import('@shikijs/langs/docker'),
    dotenv: () => import('@shikijs/langs/dotenv'),
    go: () => import('@shikijs/langs/go'),
    graphql: () => import('@shikijs/langs/graphql'),
    html: () => import('@shikijs/langs/html'),
    ini: () => import('@shikijs/langs/ini'),
    java: () => import('@shikijs/langs/java'),
    javascript: () => import('@shikijs/langs/javascript'),
    json: () => import('@shikijs/langs/json'),
    jsonc: () => import('@shikijs/langs/jsonc'),
    jsx: () => import('@shikijs/langs/jsx'),
    kotlin: () => import('@shikijs/langs/kotlin'),
    less: () => import('@shikijs/langs/less'),
    markdown: () => import('@shikijs/langs/markdown'),
    nginx: () => import('@shikijs/langs/nginx'),
    php: () => import('@shikijs/langs/php'),
    powershell: () => import('@shikijs/langs/powershell'),
    python: () => import('@shikijs/langs/python'),
    ruby: () => import('@shikijs/langs/ruby'),
    rust: () => import('@shikijs/langs/rust'),
    scss: () => import('@shikijs/langs/scss'),
    sql: () => import('@shikijs/langs/sql'),
    svelte: () => import('@shikijs/langs/svelte'),
    swift: () => import('@shikijs/langs/swift'),
    toml: () => import('@shikijs/langs/toml'),
    tsx: () => import('@shikijs/langs/tsx'),
    typescript: () => import('@shikijs/langs/typescript'),
    vue: () => import('@shikijs/langs/vue'),
    xml: () => import('@shikijs/langs/xml'),
    yaml: () => import('@shikijs/langs/yaml'),
} as const;
const SHIKI_THEMES = {
    'github-light': () => import('@shikijs/themes/github-light'),
    'github-dark-dimmed': () => import('@shikijs/themes/github-dark-dimmed'),
} as const;
const PRELOADED_LANGUAGES = [
    'javascript',
    'typescript',
    'json',
    'bash',
    'markdown',
] as const;
let highlighterPromise: Promise<Highlighter> | null = null;
const loadingLanguages = new Map<string, Promise<boolean>>();
const highlightedCodeCache = new Map<string, string>();
const LANG_ALIASES: Record<string, string> = {
    js: 'javascript',
    ts: 'typescript',
    jsx: 'jsx',
    tsx: 'tsx',
    sh: 'bash',
    shell: 'bash',
    zsh: 'bash',
    yml: 'yaml',
    py: 'python',
    rb: 'ruby',
    cs: 'csharp',
    'c++': 'cpp',
    'c#': 'csharp',
    golang: 'go',
    md: 'markdown',
    ps1: 'powershell',
    dockerfile: 'docker',
    htm: 'html',
    html5: 'html',
    json5: 'jsonc',
    gql: 'graphql',
    kt: 'kotlin',
    rs: 'rust',
    env: 'dotenv',
    conf: 'ini',
};
async function getHighlighter(): Promise<Highlighter | null> {
    if (!highlighterPromise) {
        const loading = withTimeout((async () => {
            const [{ createBundledHighlighter }, { createJavaScriptRegexEngine }] = await Promise.all([
                import('@shikijs/core'),
                import('@shikijs/engine-javascript'),
            ]);
            const createHighlighter = createBundledHighlighter({
                langs: SHIKI_LANGUAGES,
                themes: SHIKI_THEMES,
                engine: () => createJavaScriptRegexEngine(),
            });
            return (await createHighlighter({
                themes: ['github-light', 'github-dark-dimmed'],
                langs: [...PRELOADED_LANGUAGES],
            })) as unknown as Highlighter;
        })(), OPTIONAL_RENDERER_LOAD_TIMEOUT_MS, t("markdown.code_highlighting_timed_out_while_loading"));
        highlighterPromise = loading;
        void loading.catch((err) => {
            if (highlighterPromise === loading)
                highlighterPromise = null;
            console.warn(t("markdown.inkstone_code_highlighting_failed_showing_plain_text"), err);
        });
    }
    try {
        return await highlighterPromise;
    }
    catch {
        return null;
    }
}
async function ensureLanguage(highlighter: Highlighter, lang: string): Promise<boolean> {
    if (!lang)
        return false;
    const requested = lang.trim().toLowerCase();
    const normalized = LANG_ALIASES[requested] ?? requested;
    if (highlighter.getLoadedLanguages().includes(normalized))
        return true;
    let pending = loadingLanguages.get(normalized);
    if (!pending) {
        pending = (async () => {
            try {
                const loader = highlighter.getBundledLanguages()[normalized];
                if (!loader)
                    return false;
                await highlighter.loadLanguage(loader);
                return true;
            }
            catch {
                return false;
            }
        })();
        loadingLanguages.set(normalized, pending);
        void pending.then((loaded) => {
            if (!loaded && loadingLanguages.get(normalized) === pending) {
                loadingLanguages.delete(normalized);
            }
        });
    }
    return pending;
}
async function highlightCodeBlocks(root: HTMLElement): Promise<void> {
    const pending = [...root.querySelectorAll<HTMLElement>('.code-block')]
        .map((block) => {
        const pre = block.querySelector<HTMLElement>('pre.shiki-pending');
        const code = pre?.textContent ?? '';
        const lang = block.dataset.lang ?? '';
        const requested = lang.trim().toLowerCase();
        const key = `${LANG_ALIASES[requested] ?? requested}\u0000${code}`;
        return pre ? { block, pre, code, lang, key } : null;
    })
        .filter((item): item is NonNullable<typeof item> => item !== null);
    for (let index = pending.length - 1; index >= 0; index--) {
        const item = pending[index]!;
        const cached = highlightedCodeCache.get(item.key);
        if (!cached)
            continue;
        item.pre.outerHTML = cached;
        decorateCodeBlock(item.block);
        pending.splice(index, 1);
    }
    if (!pending.length)
        return;
    const highlighter = await getHighlighter();
    if (!highlighter) {
        pending.forEach(({ block }) => {
            decorateCodeBlock(block);
        });
        return;
    }
    for (const { block, pre, code, lang, key } of pending) {
        const ok = lang ? await ensureLanguage(highlighter, lang) : false;
        const requested = lang.trim().toLowerCase();
        try {
            const html = highlighter.codeToHtml(code, {
                lang: ok ? (LANG_ALIASES[requested] ?? requested) : 'text',
                themes: { light: 'github-light', dark: 'github-dark-dimmed' },
                defaultColor: 'light',
            });
            remember(highlightedCodeCache, key, html, 180);
            pre.outerHTML = html;
            decorateCodeBlock(block);
        }
        catch {
            decorateCodeBlock(block);
        }
    }
}
export function decorateCodeBlock(block: HTMLElement): void {
    const pre = block.querySelector<HTMLElement>('pre');
    const code = pre?.querySelector<HTMLElement>('code');
    if (!pre || !code)
        return;
    let lines = [...code.querySelectorAll<HTMLElement>(':scope > .line')];
    if (!lines.length) {
        const source = code.textContent ?? '';
        code.replaceChildren();
        const values = source.replace(/\n$/, '').split('\n');
        values.forEach((value, index) => {
            const line = document.createElement('span');
            line.className = 'line';
            line.textContent = value || ' ';
            code.append(line);
            if (index < values.length - 1)
                code.append('\n');
        });
        lines = [...code.querySelectorAll<HTMLElement>(':scope > .line')];
    }
    const start = Math.max(1, Number(block.dataset.codeStart) || 1);
    const highlighted = new Set((block.dataset.highlightLines ?? '')
        .split(',')
        .map(Number)
        .filter((value) => Number.isInteger(value) && value > 0));
    const numbered = block.dataset.lineNumbers === 'true';
    block.classList.toggle('has-line-numbers', numbered);
    lines.forEach((line, index) => {
        line.dataset.lineNumber = String(start + index);
        line.classList.toggle('highlighted', highlighted.has(index + 1));
    });
}
let generatedCodeBlockId = 0;

export function configureCodeBlockCollapsing(root: HTMLElement, collapseLines: number): void {
    const threshold = Number.isInteger(collapseLines) && collapseLines >= 8 ? collapseLines : 0;
    root.querySelectorAll<HTMLElement>('.code-block:not(.markdown-example-code)').forEach((block) => {
        const button = block.querySelector<HTMLButtonElement>('[data-code-collapse]');
        const pre = block.querySelector<HTMLElement>(':scope > pre');
        const lineCount = block.querySelectorAll(':scope pre code > .line').length;
        const wasExpanded = block.classList.contains('is-code-expanded');
        block.classList.remove('is-code-collapsed', 'is-code-expanded');
        delete block.dataset.codeCollapseLines;
        delete block.dataset.codeLineCount;
        delete block.dataset.codeCollapseMaxHeight;
        if (pre)
            pre.style.maxHeight = '';
        button?.remove();
        if (!threshold || lineCount <= threshold)
            return;
        const head = block.querySelector<HTMLElement>(':scope > .code-block-head');
        if (!head)
            return;
        block.dataset.codeCollapseLines = String(threshold);
        block.dataset.codeLineCount = String(lineCount);
        block.classList.add(wasExpanded ? 'is-code-expanded' : 'is-code-collapsed');
        const maxHeight = `${threshold * 1.56 + 1.5}em`;
        block.dataset.codeCollapseMaxHeight = maxHeight;
        if (pre)
            pre.style.maxHeight = wasExpanded ? '' : maxHeight;
        const codeId = pre?.id || `ink-code-${++generatedCodeBlockId}`;
        if (pre)
            pre.id = codeId;
        const toggle = document.createElement('button');
        toggle.className = 'code-collapse';
        toggle.type = 'button';
        toggle.dataset.codeCollapse = '1';
        toggle.setAttribute('aria-controls', codeId);
        toggle.setAttribute('aria-expanded', String(wasExpanded));
        toggle.textContent = wasExpanded
            ? t('markdown.collapse_code')
            : t('markdown.show_more_code', { count: lineCount - threshold });
        head.insertBefore(toggle, head.querySelector('[data-copy]'));
    });
}
export function toggleCodeBlockCollapse(button: HTMLButtonElement): void {
    const block = button.closest<HTMLElement>('.code-block');
    if (!block)
        return;
    const expanded = block.classList.toggle('is-code-expanded');
    block.classList.toggle('is-code-collapsed', !expanded);
    const pre = block.querySelector<HTMLElement>(':scope > pre');
    if (pre)
        pre.style.maxHeight = expanded ? '' : block.dataset.codeCollapseMaxHeight ?? '';
    button.setAttribute('aria-expanded', String(expanded));
    button.textContent = expanded
        ? t('markdown.collapse_code')
        : t('markdown.show_more_code', {
            count: Math.max(0, Number(block.dataset.codeLineCount) - Number(block.dataset.codeCollapseLines)),
        });
}
interface KatexLike {
    renderToString: (tex: string, options?: Record<string, unknown>) => string;
}
let katexPromise: Promise<KatexLike> | null = null;
const mathCache = new Map<string, string>();
async function getKatex(): Promise<KatexLike | null> {
    if (!katexPromise) {
        const loading = withTimeout((async () => {
            const [katex] = await Promise.all([import('katex'), import('katex/dist/katex.min.css')]);
            return (katex.default ?? katex) as unknown as KatexLike;
        })(), OPTIONAL_RENDERER_LOAD_TIMEOUT_MS, t("markdown.math_rendering_timed_out_while_loading"));
        katexPromise = loading;
        void loading.catch((err) => {
            if (katexPromise === loading)
                katexPromise = null;
            console.warn(t("markdown.inkstone_math_rendering_failed_to_load"), err);
        });
    }
    try {
        return await katexPromise;
    }
    catch {
        return null;
    }
}
async function renderMath(root: HTMLElement): Promise<void> {
    const pending = [...root.querySelectorAll<HTMLElement>('[data-math]')]
        .filter((node) => !node.dataset.rendered)
        .map((node) => {
        const source = decodeDataValue(node.dataset.math);
        const display = node.classList.contains('math-block');
        return { node, source, display, key: `${display ? 'block' : 'inline'}\u0000${source}` };
    });
    for (let index = pending.length - 1; index >= 0; index--) {
        const item = pending[index]!;
        const cached = mathCache.get(item.key);
        if (!cached)
            continue;
        item.node.innerHTML = cached;
        item.node.classList.remove('math-source');
        item.node.dataset.rendered = '1';
        pending.splice(index, 1);
    }
    if (!pending.length)
        return;
    const katex = await getKatex();
    if (!katex) {
        pending.forEach(({ node, source, display }) => showMathSource(node, source, display));
        return;
    }
    for (const { node, source, display, key } of pending) {
        try {
            const html = katex.renderToString(source, {
                displayMode: display,
                throwOnError: false,
                errorColor: 'var(--danger)',
                strict: false,
                output: 'html',
            });
            remember(mathCache, key, html, 160);
            node.innerHTML = html;
            node.classList.remove('math-source');
            node.dataset.rendered = '1';
        }
        catch (err) {
            node.innerHTML = `<code class="math-error">${escapeHtml(source)}</code>`;
            node.dataset.rendered = '1';
            void err;
        }
    }
}
function showMathSource(root: HTMLElement): void;
function showMathSource(node: HTMLElement, source: string, display: boolean): void;
function showMathSource(target: HTMLElement, source?: string, display?: boolean): void {
    if (source === undefined) {
        target.querySelectorAll<HTMLElement>('[data-math]').forEach((node) => {
            showMathSource(node, decodeDataValue(node.dataset.math), node.classList.contains('math-block'));
        });
        return;
    }
    delete target.dataset.rendered;
    target.classList.add('math-source');
    target.textContent = display ? `$$\n${source}\n$$` : `$${source}$`;
}
type MermaidApi = typeof import('mermaid').default;
type MermaidTheme = 'dark' | 'default';
const MERMAID_LOAD_TIMEOUT_MS = 15000;
const MERMAID_RENDER_TIMEOUT_MS = 10000;
const MERMAID_CANCELLED = Symbol('mermaid-cancelled');
let mermaidPromise: Promise<MermaidApi> | null = null;
let mermaidTheme: 'dark' | 'default' | null = null;
let mermaidSeq = 0;
let mermaidRenderQueue: Promise<void> = Promise.resolve();
const mermaidCache = new Map<string, string>();
async function getMermaid(): Promise<MermaidApi> {
    if (!mermaidPromise) {
        const loading = withTimeout(import('mermaid').then((mod) => mod.default), MERMAID_LOAD_TIMEOUT_MS, t("markdown.diagram_rendering_timed_out_while_loading"));
        mermaidPromise = loading;
        void loading.catch((err) => {
            if (mermaidPromise === loading)
                mermaidPromise = null;
            console.warn(t("markdown.inkstone_diagram_rendering_failed_to_load"), err);
        });
    }
    return mermaidPromise;
}
function initializeMermaid(mermaid: MermaidApi, theme: MermaidTheme): void {
    if (mermaidTheme !== theme) {
        mermaidTheme = theme;
        mermaid.initialize({
            startOnLoad: false,
            theme,
            securityLevel: 'strict',
            suppressErrorRendering: true,
            fontFamily: getComputedStyle(document.documentElement).getPropertyValue('--font-ui').trim() ||
                'system-ui, sans-serif',
            themeVariables: {
                fontSize: '13px',
                background: 'transparent',
            },
        });
    }
}
function createMermaidRenderHost(): HTMLDivElement {
    const host = document.createElement('div');
    host.dataset.mermaidRenderHost = '1';
    host.setAttribute('aria-hidden', 'true');
    Object.assign(host.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100vw',
        visibility: 'hidden',
        pointerEvents: 'none',
        zIndex: '-1',
    });
    document.body.append(host);
    return host;
}
function mermaidKey(source: string, dark: boolean): string {
    return `${dark ? 'dark' : 'light'}\u0000${source}`;
}
function hydrateCachedMermaid(root: HTMLElement, dark: boolean): void {
    root.querySelectorAll<HTMLElement>('[data-mermaid]').forEach((node) => {
        if (node.dataset.rendered === currentSignature(node, dark))
            return;
        const cached = mermaidCache.get(mermaidKey(mermaidSource(node), dark));
        if (cached)
            applyMermaidSvg(node, cached, dark);
    });
}
function showMermaidSource(root: HTMLElement): void {
    root.querySelectorAll<HTMLElement>('[data-mermaid]').forEach((node) => {
        node.classList.remove('loading');
        node.classList.add('mermaid-source');
        node.removeAttribute('aria-busy');
        const code = document.createElement('code');
        code.textContent = mermaidSource(node);
        node.replaceChildren(code);
    });
}
export interface MermaidRenderHooks<T = unknown> {
    isCurrent?: () => boolean;
    beforeUpdate?: () => T;
    afterUpdate?: (snapshot: T) => void;
}
export async function renderPendingMermaid<T = unknown>(root: HTMLElement, dark: boolean, hooks: MermaidRenderHooks<T> = {}): Promise<void> {
    const isCurrent = () => hooks.isCurrent?.() !== false;
    const pending = [...root.querySelectorAll<HTMLElement>('[data-mermaid]')]
        .filter((node) => node.dataset.rendered !== currentSignature(node, dark))
        .map((node) => {
        const source = mermaidSource(node);
        return { node, source, key: mermaidKey(source, dark) };
    });
    for (const { node, source, key } of pending) {
        if (!isCurrent())
            return;
        try {
            const svg = await queueMermaidRender(key, source, dark, () => {
                return (isCurrent() &&
                    root.contains(node) &&
                    mermaidSource(node) === source &&
                    node.dataset.rendered !== currentSignature(node, dark));
            });
            if (!isCurrent() ||
                !root.contains(node) ||
                mermaidSource(node) !== source ||
                node.dataset.rendered === currentSignature(node, dark)) {
                continue;
            }
            updateMermaidNode(hooks, () => applyMermaidSvg(node, svg, dark));
        }
        catch (err) {
            if (err === MERMAID_CANCELLED || !isCurrent() || !root.contains(node))
                return;
            if (mermaidSource(node) !== source)
                continue;
            updateMermaidNode(hooks, () => showMermaidError(node, err, source));
        }
    }
}
function queueMermaidRender(key: string, source: string, dark: boolean, isCurrent: () => boolean): Promise<string> {
    const task = mermaidRenderQueue.then(async () => {
        const cached = mermaidCache.get(key);
        if (cached)
            return cached;
        if (!isCurrent())
            throw MERMAID_CANCELLED;
        const mermaid = await getMermaid();
        if (!isCurrent())
            throw MERMAID_CANCELLED;
        initializeMermaid(mermaid, dark ? 'dark' : 'default');
        const renderHost = createMermaidRenderHost();
        try {
            const { svg } = await withTimeout(mermaid.render(`ink-mermaid-${++mermaidSeq}`, source, renderHost), MERMAID_RENDER_TIMEOUT_MS, t("markdown.diagram_rendering_timed_out_check_the_diagram_or_try_again_later"));
            remember(mermaidCache, key, svg, 60);
            return svg;
        }
        finally {
            renderHost.remove();
        }
    });
    mermaidRenderQueue = task.then(() => undefined, () => undefined);
    return task;
}
function applyMermaidSvg(node: HTMLElement, svg: string, dark: boolean): void {
    node.innerHTML = svg;
    node.classList.remove('loading', 'mermaid-source', 'has-error');
    node.setAttribute('aria-busy', 'false');
    node.dataset.rendered = currentSignature(node, dark);
}
function showMermaidError(node: HTMLElement, err: unknown, source: string): void {
    const wrap = document.createElement('div');
    wrap.className = 'mermaid-error';
    const message = document.createElement('span');
    message.className = 'mermaid-error-message';
    const detail = err instanceof Error ? err.message : String(err);
    message.textContent = detail.slice(0, 500);
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'mermaid-retry';
    retry.dataset.mermaidRetry = '1';
    retry.textContent = t("common.retry");
    const code = document.createElement('code');
    code.textContent = source;
    wrap.append(message, retry, code);
    node.replaceChildren(wrap);
    node.classList.remove('loading', 'mermaid-source');
    node.classList.add('has-error');
    node.setAttribute('aria-busy', 'false');
    delete node.dataset.rendered;
}
export function resetMermaidNode(node: HTMLElement): void {
    delete node.dataset.rendered;
    node.classList.remove('has-error', 'mermaid-source');
    node.classList.add('loading');
    node.setAttribute('aria-busy', 'true');
    node.textContent = t("markdown.redrawing_chart");
}
function updateMermaidNode<T>(hooks: MermaidRenderHooks<T>, update: () => void): void {
    if (!hooks.beforeUpdate) {
        update();
        return;
    }
    const snapshot = hooks.beforeUpdate();
    update();
    hooks.afterUpdate?.(snapshot);
}
function currentSignature(node: HTMLElement, dark: boolean): string {
    const source = mermaidSource(node);
    return `${dark ? 'd' : 'l'}:${source.length}:${shortHash(source)}`;
}
function mermaidSource(node: HTMLElement): string {
    return decodeDataValue(node.dataset.mermaid);
}
export interface EnhanceOptions {
    math: boolean;
    mermaid: boolean;
    dark: boolean;
    codeBlockCollapseLines?: number;
}
export async function enhancePreview(root: HTMLElement, options: EnhanceOptions): Promise<void> {
    if (options.mermaid) {
        hydrateCachedMermaid(root, options.dark);
        const hasPendingDiagram = [...root.querySelectorAll<HTMLElement>('[data-mermaid]')].some((node) => node.dataset.rendered !== currentSignature(node, options.dark));
        if (hasPendingDiagram)
            void getMermaid().catch(() => { });
    }
    else {
        showMermaidSource(root);
    }
    if (!options.math)
        showMathSource(root);
    await Promise.allSettled([
        highlightCodeBlocks(root),
        options.math ? renderMath(root) : Promise.resolve(),
    ]);
    configureCodeBlockCollapsing(root, options.codeBlockCollapseLines ?? 24);
}
export function invalidateMermaidTheme(root: HTMLElement | null): void {
    root?.querySelectorAll<HTMLElement>('[data-mermaid]').forEach((node) => {
        delete node.dataset.rendered;
    });
}
function escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function remember<K, V>(cache: Map<K, V>, key: K, value: V, limit: number): void {
    if (cache.has(key))
        cache.delete(key);
    cache.set(key, value);
    while (cache.size > limit) {
        const oldest = cache.keys().next().value as K | undefined;
        if (oldest === undefined)
            break;
        cache.delete(oldest);
    }
}
function shortHash(value: string): string {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index++) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
}
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = window.setTimeout(() => reject(new Error(message)), timeoutMs);
        promise.then((value) => {
            window.clearTimeout(timer);
            resolve(value);
        }, (err) => {
            window.clearTimeout(timer);
            reject(err);
        });
    });
}
