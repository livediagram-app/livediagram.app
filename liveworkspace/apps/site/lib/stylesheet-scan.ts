import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

// What each of the site's stylesheets scans, read the way Tailwind reads it, for the guards that check what the
// sheets emit together (dark-pair-guard.test.ts, hover-tie-guard.test.ts; liveworkspace/docs/specs/010-site/site.md
// "Stylesheets").

export const SITE = resolve(import.meta.dirname, '..');
export const REPO = resolve(SITE, '../../..');
const SCANNED = /\.(tsx?|jsx?|mjs|mdx?|html)$/;
export const PAGE_SHEETS = [
  'app/telemetry/telemetry.css',
  'app/explorer/explorer.css',
  'app/community/community.css',
];

// A colour utility's family and variants: `dark:hover:bg-slate-800` is family `bg` under `hover`, dark.
export const COLOUR =
  /^(.+?)-(white|black|transparent|current|\[[^\]]+\]|(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|brand)-\d{2,3})(\/[\w.[\]]+)?$/;

type Sheet = { sources: string[]; excluded: string[] };

// What a sheet scans: its `@source` paths (and those of the stylesheets it imports, relative to each), less its
// `@source not` paths, plus the app's own folder when it imports all of Tailwind (automatic detection).
export function readSheet(path: string, sheet: Sheet = { sources: [], excluded: [] }): Sheet {
  const css = readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const [, not, source] of css.matchAll(/@source\s+(not\s+)?'([^']+)'/g)) {
    (not ? sheet.excluded : sheet.sources).push(resolve(dirname(path), source!));
  }
  for (const [, spec, rest] of css.matchAll(/@import\s+'([^']+)'([^;]*);/g)) {
    if (spec === 'tailwindcss' && !rest!.includes('source(none)')) sheet.sources.push(SITE);
    const local = spec!.startsWith('.')
      ? resolve(dirname(path), spec!)
      : spec!.startsWith('@liveworkspace/')
        ? join(REPO, 'packages', spec!.slice('@liveworkspace/'.length))
        : null;
    if (local?.endsWith('.css') && existsSync(local)) readSheet(local, sheet);
  }
  return sheet;
}

function walk(path: string, out: Set<string>): void {
  if (statSync(path).isFile()) {
    if (SCANNED.test(path)) out.add(path);
    return;
  }
  for (const name of readdirSync(path)) {
    if (name === 'node_modules' || name === 'out' || name.startsWith('.')) continue;
    walk(join(path, name), out);
  }
}

export function filesOf(sheet: Sheet): Set<string> {
  const all = new Set<string>();
  for (const source of sheet.sources) if (existsSync(source)) walk(source, all);
  return new Set(
    [...all].filter((f) => !sheet.excluded.some((not) => f === not || f.startsWith(`${not}/`))),
  );
}

// Every class-like token in a text, as Tailwind's scanner would see it (split on what can't be in a class).
export const tokensOf = (text: string): string[] =>
  (text.match(/(?:\[[^\]\s'"`]*\]|[^\s'"`<>{};=[])+/g) ?? []).map((t) => t.replace(/[),]+$/, ''));

const contents = new Map<string, string>();
export const read = (file: string) => {
  let text = contents.get(file);
  if (text === undefined) contents.set(file, (text = readFileSync(file, 'utf8')));
  return text;
};

export type Scanned = { path: string; files: Set<string>; tokens: Set<string> };

export function scan(path: string): Scanned {
  const files = filesOf(readSheet(join(SITE, path)));
  const tokens = new Set<string>();
  for (const file of files) for (const token of tokensOf(read(file))) tokens.add(token);
  return { path, files, tokens };
}
