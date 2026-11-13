import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';

// The site loads its own stylesheet (app/globals.css) on every page, and a page's own after it on three routes
// (liveworkspace/docs/specs/010-site/site.md "Stylesheets"). Every sheet puts its utilities in one shared layer, and
// a `dark:` utility weighs no more than a plain one (`:where(.dark, .dark *)`), so between sheets the later rule
// wins. Next keeps a route's sheet loaded after a client-side move, so a page sheet that emits a component's light
// class (`hover:bg-slate-100`) without the dark class beside it on that element (`dark:hover:bg-slate-800`) paints
// the light one over the dark one wherever that component is drawn, on every page visited after (#1606: the account
// menu's hovered row went pale). This guard reads what each sheet scans, as Tailwind does, finds every such pair,
// and checks each page sheet's dark-pairs.css names the dark half (`@source inline`), so the page sheet emits it
// after the light one. `vitest run dark-pair-guard.test.ts -u` writes those files again.

const SITE = import.meta.dirname;
const REPO = resolve(SITE, '../../..');
const SCANNED = /\.(tsx?|jsx?|mjs|mdx?|html)$/;
const PAGE_SHEETS = [
  'app/telemetry/telemetry.css',
  'app/explorer/explorer.css',
  'app/community/community.css',
];

type Sheet = { sources: string[]; excluded: string[] };

// What a sheet scans: its `@source` paths (and those of the stylesheets it imports, relative to each), less its
// `@source not` paths, plus the app's own folder when it imports all of Tailwind (automatic detection).
function readSheet(path: string, sheet: Sheet = { sources: [], excluded: [] }): Sheet {
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

function filesOf(sheet: Sheet): Set<string> {
  const all = new Set<string>();
  for (const source of sheet.sources) if (existsSync(source)) walk(source, all);
  return new Set(
    [...all].filter((f) => !sheet.excluded.some((not) => f === not || f.startsWith(`${not}/`))),
  );
}

// Every class-like token in a text, as Tailwind's scanner would see it (split on what can't be in a class).
const tokensOf = (text: string) => text.split(/[\s'"`<>{};=]+/).map((t) => t.replace(/[),]+$/, ''));

// A colour utility's family and variants: `dark:hover:bg-slate-800` is family `bg` under `hover`, dark.
const COLOUR =
  /^(.+?)-(white|black|transparent|current|\[[^\]]+\]|(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|brand)-\d{2,3})(\/[\w.[\]]+)?$/;

function parse(token: string): { dark: boolean; variants: string; family: string } | null {
  const parts = token.split(':');
  const match = COLOUR.exec(parts.pop()!.replace(/^!|!$/g, ''));
  if (!match) return null;
  const variants = parts
    .filter((v) => v !== 'dark')
    .sort()
    .join(':');
  return { dark: parts.includes('dark'), variants, family: match[1]! };
}

type Pair = { file: string; light: string; dark: string };

// The light and dark colour classes one element sets together: the same family under the same variants, in one
// string or on one line (`cn('bg-white', 'dark:bg-slate-900')`). Test files are scanned but never drawn.
function pairsIn(file: string, text: string): Pair[] {
  if (/\.test\.tsx?$/.test(file)) return [];
  const units = [...text.matchAll(/`[^`]*`/g)].map(([m]) => m).concat(text.split('\n'));
  const pairs = new Map<string, Pair>();
  for (const unit of units) {
    const parsed = unit
      .split(/[\s'"`,()]+/)
      .filter(Boolean)
      .map((token) => ({ token, at: parse(token) }));
    for (const d of parsed) {
      if (!d.at?.dark) continue;
      for (const l of parsed) {
        if (l.at && !l.at.dark && l.at.variants === d.at.variants && l.at.family === d.at.family) {
          pairs.set(`${l.token} ${d.token}`, { file, light: l.token, dark: d.token });
        }
      }
    }
  }
  return [...pairs.values()];
}

type Scanned = { path: string; files: Set<string>; tokens: Set<string> };
type Clash = Pair & { sheet: string };

// Each page sheet against every pair drawn from a file it doesn't scan: it clashes when it emits the light class and
// not the dark one. A pair from a file a sheet scans is emitted whole, in Tailwind's order (light, then dark).
function clashesOf(pages: Scanned[], pairs: Pair[]): Clash[] {
  const out: Clash[] = [];
  for (const { path, files, tokens } of pages) {
    for (const pair of pairs) {
      if (files.has(pair.file) || !tokens.has(pair.light) || tokens.has(pair.dark)) continue;
      out.push({ ...pair, sheet: path });
    }
  }
  return out;
}

const contents = new Map<string, string>();
const read = (file: string) => {
  let text = contents.get(file);
  if (text === undefined) contents.set(file, (text = readFileSync(file, 'utf8')));
  return text;
};

function scan(path: string): Scanned {
  const files = filesOf(readSheet(join(SITE, path)));
  const tokens = new Set<string>();
  for (const file of files) for (const token of tokensOf(read(file))) tokens.add(token);
  return { path, files, tokens };
}

// The dark halves a page sheet names in its dark-pairs.css.
const inlineOf = (css: string) =>
  [...css.matchAll(/@source inline\("([^"]*)"\)/g)].flatMap(([, list]) => list!.split(/\s+/));

const pairsPath = (sheet: string) => join(dirname(sheet), 'dark-pairs.css');

function darkPairsCss(needed: string[]): string {
  const lines = needed.map((token) => `@source inline("${token}");`);
  return `/* Generated by dark-pair-guard.test.ts: \`vitest run dark-pair-guard.test.ts -u\` in liveworkspace/apps/site writes
 * it again. The dark halves of the colour pairs drawn from files this page's sheet doesn't scan, whose light half it
 * emits: named here, the sheet emits each after its light half, so a dark hover stays dark whatever loads after it
 * (liveworkspace/docs/specs/010-site/site.md "Stylesheets"). */
${lines.join('\n')}
`;
}

describe('dark pairs across stylesheets', () => {
  const globals = scan('app/globals.css');
  const pages = PAGE_SHEETS.map(scan);
  let pairs: Pair[] = [];
  let found: Clash[] = [];
  const ms = cpuMsOf(() => {
    const drawn = new Set([globals, ...pages].flatMap(({ files }) => [...files]));
    pairs = [...drawn].flatMap((file) => pairsIn(file, read(file)));
    found = clashesOf(pages, pairs);
  });

  it('reads every sheet the site loads, and the pairs they draw, within budget', () => {
    for (const { path, files } of [globals, ...pages]) expect(files.size, path).toBeGreaterThan(0);
    expect(pairs.length).toBeGreaterThan(500);
    console.info(
      `[dark pairs] ${pairs.length} pairs, ${found.length} needing a page sheet's dark half, in ${ms.toFixed(0)} ms of CPU`,
    );
    expect(ms).toBeLessThan(cpuBudgetMs(5_000));
  });

  it.each(PAGE_SHEETS)(
    '%s imports its dark-pairs.css and names every dark half it needs',
    async (sheet) => {
      const needed = [...new Set(found.filter((c) => c.sheet === sheet).map((c) => c.dark))].sort();
      await expect(darkPairsCss(needed)).toMatchFileSnapshot(join(SITE, pairsPath(sheet)));
      expect(readFileSync(join(SITE, sheet), 'utf8')).toContain("@import './dark-pairs.css';");
      // With them, the sheet emits no light colour without its dark pair.
      const named = new Set(inlineOf(read(join(SITE, pairsPath(sheet)))));
      const page = pages.find((p) => p.path === sheet)!;
      const left = clashesOf([{ ...page, tokens: new Set([...page.tokens, ...named]) }], pairs);
      expect(left.map((c) => `${relative(REPO, c.file)}: ${c.light} ${c.dark}`)).toEqual([]);
    },
  );

  it("fails when a page sheet would emit a shared component's light hover without its dark pair", () => {
    // The account menu's hovered row before #1606, drawn by the site's sheet, and a page sheet whose own file emits
    // the light half only.
    const menu = pairsIn(
      '/packages/account-menu/src/AccountMenu.tsx',
      "<a className='px-3 hover:bg-slate-100 dark:hover:bg-slate-800'>",
    );
    expect(menu).toEqual([
      {
        file: '/packages/account-menu/src/AccountMenu.tsx',
        light: 'hover:bg-slate-100',
        dark: 'dark:hover:bg-slate-800',
      },
    ]);
    const page = (text: string, files = ['/app/telemetry/Page.tsx']): Scanned => ({
      path: 'app/telemetry/telemetry.css',
      files: new Set(files),
      tokens: new Set(tokensOf(text)),
    });
    expect(clashesOf([page("<b className='hover:bg-slate-100'>")], menu)).toEqual([
      { ...menu[0], sheet: 'app/telemetry/telemetry.css' },
    ]);
    // Not when it emits the dark half too, nor when it scans the menu (it emits the pair whole), nor when it never
    // emits the light half.
    expect(clashesOf([page('hover:bg-slate-100 dark:hover:bg-slate-800')], menu)).toEqual([]);
    expect(
      clashesOf([page('hover:bg-slate-100', ['/packages/account-menu/src/AccountMenu.tsx'])], menu),
    ).toEqual([]);
    expect(clashesOf([page('hover:bg-slate-200')], menu)).toEqual([]);
  });

  it('pairs by family and variants, across a line, and never in a test file', () => {
    const at = (text: string) => pairsIn('/x.tsx', text).map((p) => `${p.light} ${p.dark}`);
    expect(at("cn('bg-white', 'dark:bg-slate-900')")).toEqual(['bg-white dark:bg-slate-900']);
    expect(at("'text-sm text-slate-600 dark:text-slate-300 hover:text-slate-900'")).toEqual([
      'text-slate-600 dark:text-slate-300',
    ]);
    expect(at("'group-hover:text-brand-700 dark:group-hover:text-brand-300/80'")).toEqual([
      'group-hover:text-brand-700 dark:group-hover:text-brand-300/80',
    ]);
    expect(at("'hover:bg-[#fff] hover:dark:bg-[#000] !bg-black'")).toEqual([
      'hover:bg-[#fff] hover:dark:bg-[#000]',
    ]);
    expect(at("'p-2 dark:p-3'")).toEqual([]);
    expect(pairsIn('/x.test.tsx', "'bg-white dark:bg-slate-900'")).toEqual([]);
  });
});
