import type { IconName } from 'obsidian';

export type CodeLanguageGroup =
	| 'config'
	| 'data'
	| 'document'
	| 'generic'
	| 'markup'
	| 'math'
	| 'script'
	| 'shell'
	| 'system'
	| 'web';

export interface CodeLanguageInfo {
	brandIconKey?: string;
	canonical: string;
	group: CodeLanguageGroup;
	icon?: IconName;
	label: string;
	raw: string;
}

interface LanguageDefinition {
	aliases?: readonly string[];
	canonical: string;
	group: CodeLanguageGroup;
	icon: IconName;
	label: string;
}

const DEFINITIONS: readonly LanguageDefinition[] = [
	definition('javascript', 'JavaScript', 'web', 'braces', ['js', 'node', 'nodejs']),
	definition('typescript', 'TypeScript', 'web', 'braces', ['ts']),
	definition('jsx', 'JavaScript XML', 'web', 'braces'),
	definition('tsx', 'TypeScript XML', 'web', 'braces'),
	definition('vue', 'Vue', 'web', 'braces'),
	definition('svelte', 'Svelte', 'web', 'braces'),
	definition('html', 'HTML', 'markup', 'tags'),
	definition('xml', 'XML', 'markup', 'tags', ['xquery']),
	definition('svg', 'SVG', 'markup', 'shapes'),
	definition('css', 'CSS', 'web', 'palette'),
	definition('scss', 'SCSS', 'web', 'palette', ['sass']),
	definition('less', 'Less', 'web', 'palette'),
	definition('python', 'Python', 'script', 'file-code-2', ['py']),
	definition('ruby', 'Ruby', 'script', 'gem', ['rb']),
	definition('php', 'PHP', 'script', 'file-code-2'),
	definition('lua', 'Lua', 'script', 'moon'),
	definition('perl', 'Perl', 'script', 'file-code-2'),
	definition('r', 'R', 'script', 'file-code-2'),
	definition('matlab', 'Matlab', 'math', 'sigma'),
	definition('wolfram', 'Wolfram', 'math', 'sigma', ['mathematica', 'wl']),
	definition('latex', 'LaTeX', 'math', 'sigma', ['tex']),
	definition('geogebra', 'GeoGebra', 'math', 'sigma', ['ggb']),
	definition('c', 'C', 'system', 'binary'),
	definition('cpp', 'C++', 'system', 'binary', ['c++']),
	definition('csharp', 'C#', 'system', 'hash', ['cs', 'c#']),
	definition('rust', 'Rust', 'system', 'settings', ['rs']),
	definition('go', 'Go', 'system', 'binary', ['golang']),
	definition('java', 'Java', 'system', 'coffee'),
	definition('kotlin', 'Kotlin', 'system', 'binary', ['kt']),
	definition('scala', 'Scala', 'system', 'binary'),
	definition('swift', 'Swift', 'system', 'bird'),
	definition('dart', 'Dart', 'system', 'binary'),
	definition('zig', 'Zig', 'system', 'zap'),
	definition('haskell', 'Haskell', 'system', 'binary', ['hs']),
	definition('fsharp', 'F#', 'system', 'hash', ['fs']),
	definition('ocaml', 'OCaml', 'system', 'binary'),
	definition('clojure', 'Clojure', 'system', 'binary', ['clj']),
	definition('elixir', 'Elixir', 'system', 'binary', ['ex']),
	definition('erlang', 'Erlang', 'system', 'binary', ['erl']),
	definition('solidity', 'Solidity', 'system', 'blocks'),
	definition('wasm', 'WebAssembly', 'system', 'binary', ['webassembly']),
	definition('assembly', 'Assembly', 'system', 'cpu', ['asm']),
	definition('vhdl', 'VHDL', 'system', 'cpu'),
	definition('verilog', 'Verilog', 'system', 'cpu'),
	definition('shell', 'Shell', 'shell', 'terminal', ['sh', 'bash', 'zsh', 'fish']),
	definition('powershell', 'PowerShell', 'shell', 'terminal', ['ps1', 'pwsh']),
	definition('batch', 'Batch', 'shell', 'terminal', ['bat', 'cmd']),
	definition('sql', 'SQL', 'data', 'database'),
	definition('graphql', 'GraphQL', 'data', 'database'),
	definition('json', 'JSON', 'data', 'file-json', ['json5']),
	definition('yaml', 'YAML', 'config', 'settings-2', ['yml']),
	definition('toml', 'TOML', 'config', 'settings-2'),
	definition('ini', 'INI', 'config', 'settings-2'),
	definition('nginx', 'Nginx', 'config', 'server'),
	definition('dockerfile', 'Dockerfile', 'config', 'container', ['docker']),
	definition('git', 'Git', 'config', 'git-branch'),
	definition('diff', 'Diff', 'document', 'git-compare'),
	definition('markdown', 'Markdown', 'document', 'file-text', ['md']),
	definition('plaintext', '纯文本', 'document', 'file-text', ['text', 'txt']),
	definition('key', 'KEY', 'config', 'key-round'),
	definition('api', 'API', 'generic', 'plug'),
	definition('url', 'URL', 'generic', 'link'),
];

const LANGUAGE_LOOKUP = new Map<string, LanguageDefinition>();
for (const definition of DEFINITIONS) {
	LANGUAGE_LOOKUP.set(definition.canonical, definition);
	for (const alias of definition.aliases ?? []) {
		LANGUAGE_LOOKUP.set(alias, definition);
	}
}

const BRAND_ICON_KEYS: Readonly<Record<string, string>> = {
	api: 'api',
	batch: 'batch',
	c: 'c',
	clojure: 'clojure',
	cpp: 'cpp',
	csharp: 'cs',
	css: 'css',
	dart: 'dart',
	diff: 'diff',
	dockerfile: 'dockerfile',
	elixir: 'elixir',
	erlang: 'erlang',
	fsharp: 'fsharp',
	geogebra: 'ggb',
	git: 'git',
	go: 'go',
	graphql: 'graphql',
	haskell: 'haskell',
	html: 'html',
	ini: 'ini',
	java: 'java',
	javascript: 'javascript',
	json: 'json',
	jsx: 'jsx',
	key: 'key',
	kotlin: 'kotlin',
	latex: 'latex',
	less: 'less',
	lua: 'lua',
	markdown: 'markdown',
	matlab: 'matlab',
	nginx: 'nginx',
	ocaml: 'ocaml',
	perl: 'perl',
	php: 'php',
	plaintext: 'txt',
	powershell: 'powershell',
	python: 'python',
	r: 'r',
	ruby: 'ruby',
	rust: 'rust',
	scala: 'scala',
	scss: 'scss',
	shell: 'shell',
	sql: 'sql',
	solidity: 'solidity',
	svelte: 'svelte',
	svg: 'svg',
	swift: 'swift',
	toml: 'toml',
	tsx: 'tsx',
	typescript: 'typescript',
	url: 'url',
	verilog: 'verilog',
	vhdl: 'vhdl',
	vue: 'vue',
	wasm: 'wasm',
	wolfram: 'wolfram',
	xml: 'xml',
	yaml: 'yaml',
	zig: 'zig',
};

const EMPTY_LANGUAGE: CodeLanguageInfo = {
	canonical: '',
	group: 'generic',
	label: '',
	raw: '',
};
const KNOWN_LANGUAGE_INFO = new Map<string, CodeLanguageInfo>();
for (const [raw, language] of LANGUAGE_LOOKUP) {
	KNOWN_LANGUAGE_INFO.set(raw, {
		brandIconKey: BRAND_ICON_KEYS[language.canonical],
		canonical: language.canonical,
		group: language.group,
		icon: language.icon,
		label: language.label,
		raw,
	});
}
const UNKNOWN_LANGUAGE_INFO = new Map<string, CodeLanguageInfo>();
const MAX_UNKNOWN_LANGUAGE_CACHE_SIZE = 64;

export function resolveCodeLanguage(rawLanguage: string): CodeLanguageInfo {
	const raw = normalizeLanguageToken(rawLanguage);
	if (!raw) {
		return EMPTY_LANGUAGE;
	}

	const known = KNOWN_LANGUAGE_INFO.get(raw);
	if (known) {
		return known;
	}

	const cachedUnknown = UNKNOWN_LANGUAGE_INFO.get(raw);
	if (cachedUnknown) {
		return cachedUnknown;
	}
	const unknown: CodeLanguageInfo = {
		canonical: raw,
		group: 'generic',
		icon: 'code-2',
		label: formatUnknownLanguage(raw),
		raw,
	};
	if (UNKNOWN_LANGUAGE_INFO.size >= MAX_UNKNOWN_LANGUAGE_CACHE_SIZE) {
		const oldest = UNKNOWN_LANGUAGE_INFO.keys().next().value;
		if (oldest !== undefined) {
			UNKNOWN_LANGUAGE_INFO.delete(oldest);
		}
	}
	UNKNOWN_LANGUAGE_INFO.set(raw, unknown);
	return unknown;
}

export function normalizeLanguageToken(language: string): string {
	return language
		.trim()
		.toLowerCase()
		.replace(/^language-/, '')
		.replace(/^\./, '');
}

function definition(
	canonical: string,
	label: string,
	group: CodeLanguageGroup,
	icon: IconName,
	aliases?: readonly string[],
): LanguageDefinition {
	return { aliases, canonical, group, icon, label };
}

function formatUnknownLanguage(language: string): string {
	return language
		.split(/[-_]/)
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(' ');
}
