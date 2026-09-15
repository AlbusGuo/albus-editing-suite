import { Platform } from 'obsidian';

const WINDOWS_FONT_ENUMERATION_SCRIPT = [
	"$ErrorActionPreference='Stop'",
	'[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)',
	'$OutputEncoding=[Text.UTF8Encoding]::new($false)',
	'Add-Type -AssemblyName System.Drawing',
	'$fonts=[System.Drawing.Text.InstalledFontCollection]::new()',
	"try {$names=@($fonts.Families|ForEach-Object {$_.Name}|Sort-Object -Unique);ConvertTo-Json -InputObject $names -Compress}finally{$fonts.Dispose()}",
].join(';');

let systemFontFamiliesPromise: Promise<string[]> | null = null;

/** Enumerate desktop font family names lazily and cache the process result. */
export function getSystemFontFamilies(): Promise<string[]> {
	systemFontFamiliesPromise ??= loadSystemFontFamilies().catch(() => []);
	return systemFontFamiliesPromise;
}

async function loadSystemFontFamilies(): Promise<string[]> {
	if (!Platform.isDesktopApp) {
		return [];
	}
	const nativeFonts = await loadObsidianNativeFontFamilies();
	if (nativeFonts.length > 0) {
		return nativeFonts;
	}
	if (Platform.isWin) {
		return loadWindowsFontFamilies();
	}
	if (Platform.isLinux) {
		return loadLinuxFontFamilies();
	}
	if (Platform.isMacOS) {
		return loadMacFontFamilies();
	}
	return [];
}

async function loadObsidianNativeFontFamilies(): Promise<string[]> {
	const requireFunction = getRuntimeRequire();
	if (!requireFunction) {
		return [];
	}
	for (const moduleId of getNativeFontModuleCandidates(requireFunction)) {
		try {
			const fontModule = requireFunction(moduleId);
			if (!isNativeFontModule(fontModule)) {
				continue;
			}
			const fonts = await fontModule.getFonts();
			return normalizeFontFamilies(Array.isArray(fonts) ? fonts : []);
		} catch {
			// Continue to the portable desktop fallback.
		}
	}
	return [];
}

function getNativeFontModuleCandidates(
	requireFunction: (moduleId: string) => unknown,
): string[] {
	const candidates = ['get-fonts'];
	try {
		const electron = requireFunction('electron');
		const pathModule = requireFunction('path');
		if (!isElectronModule(electron) || !isPathModule(pathModule)) {
			return candidates;
		}
		const appPath = electron.remote?.app?.getAppPath();
		if (!appPath) {
			return candidates;
		}
		candidates.push(pathModule.join(
			pathModule.dirname(appPath),
			'app.asar.unpacked',
			'node_modules',
			'get-fonts',
		));
	} catch {
		// The package-name candidate may still resolve.
	}
	return candidates;
}

async function loadWindowsFontFamilies(): Promise<string[]> {
	const output = await execute(
		'powershell.exe',
		[
			'-NoProfile',
			'-NonInteractive',
			'-WindowStyle',
			'Hidden',
			'-Command',
			WINDOWS_FONT_ENUMERATION_SCRIPT,
		],
	);
	const parsed = JSON.parse(
		output.replace(/^\uFEFF/u, '').trim(),
	) as unknown;
	return normalizeFontFamilies(Array.isArray(parsed) ? parsed : [parsed]);
}

async function loadLinuxFontFamilies(): Promise<string[]> {
	const output = await execute('fc-list', ['--format=%{family}\n']);
	return normalizeFontFamilies(
		output.split(/\r?\n/u).flatMap((line) => line.split(',')),
	);
}

async function loadMacFontFamilies(): Promise<string[]> {
	const output = await execute(
		'/usr/sbin/system_profiler',
		['SPFontsDataType', '-json'],
	);
	const parsed = JSON.parse(output) as unknown;
	const values: unknown[] = [];
	collectMacFontNames(parsed, values);
	return normalizeFontFamilies(values);
}

function collectMacFontNames(value: unknown, output: unknown[]): void {
	if (Array.isArray(value)) {
		for (const item of value) {
			collectMacFontNames(item, output);
		}
		return;
	}
	if (!isRecord(value)) {
		return;
	}
	if (typeof value.family === 'string') {
		output.push(value.family);
	}
	for (const nested of Object.values(value)) {
		collectMacFontNames(nested, output);
	}
}

async function execute(executable: string, args: string[]): Promise<string> {
	const requireFunction = getRuntimeRequire();
	const childProcess = requireFunction?.('child_process');
	if (!isChildProcessModule(childProcess)) {
		throw new Error('System font enumeration is unavailable');
	}
	return new Promise((resolve, reject) => {
		childProcess.execFile(executable, args, {
			encoding: 'utf8',
			maxBuffer: 2 * 1024 * 1024,
			timeout: 8000,
			windowsHide: true,
		}, (error, stdout) => {
			if (error) {
				reject(error instanceof Error ? error : new Error(String(error)));
				return;
			}
			resolve(stdout);
		});
	});
}

interface NativeFontModule {
	getFonts(): unknown;
}

interface ElectronModule {
	remote?: {
		app?: {
			getAppPath(): string;
		};
	};
}

interface PathModule {
	dirname(path: string): string;
	join(...paths: string[]): string;
}

interface ChildProcessModule {
	execFile(
		executable: string,
		args: string[],
		options: {
			encoding: 'utf8';
			maxBuffer: number;
			timeout: number;
			windowsHide: boolean;
		},
		callback: (error: Error | null, stdout: string) => void,
	): void;
}

function isChildProcessModule(value: unknown): value is ChildProcessModule {
	return isRecord(value) && typeof value.execFile === 'function';
}

function isNativeFontModule(value: unknown): value is NativeFontModule {
	return isRecord(value) && typeof value.getFonts === 'function';
}

function isElectronModule(value: unknown): value is ElectronModule {
	return isRecord(value);
}

function isPathModule(value: unknown): value is PathModule {
	return (
		isRecord(value) &&
		typeof value.dirname === 'function' &&
		typeof value.join === 'function'
	);
}

function getRuntimeRequire(): ((moduleId: string) => unknown) | null {
	return (
		window as unknown as {
			require?: (moduleId: string) => unknown;
		}
	).require ?? null;
}

function normalizeFontFamilies(values: unknown[]): string[] {
	return Array.from(new Set(
		values
			.filter((value): value is string => typeof value === 'string')
			.map((value) => value.replace(/[\r\n\0]/gu, '').trim())
			.filter((value) => value.length > 0 && value.length <= 256),
	)).sort((left, right) => left.localeCompare(right));
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
