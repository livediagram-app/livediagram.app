import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// docs/specs/004-interface-design/scrollbars.md: the themed scrollbar is the default everywhere, its thumb
// reaches 3:1 on every surface, and no other scrollbar dialect exists.

const here = fileURLToPath(new URL('.', import.meta.url));
const theme = readFileSync(join(here, '..', 'theme.css'), 'utf8');
const repo = join(here, '..', '..', '..');

// The base layer's block, found by brace matching from `@layer base {`
// blocks that mention a scrollbar.
function baseLayers(css: string): string[] {
  const out: string[] = [];
  let at = css.indexOf('@layer base');
  while (at >= 0) {
    const open = css.indexOf('{', at);
    let depth = 0;
    let i = open;
    for (; i < css.length; i++) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}' && --depth === 0) break;
    }
    out.push(css.slice(open, i + 1));
    at = css.indexOf('@layer base', i);
  }
  return out;
}

const tokens = (block: string): Record<string, string> =>
  Object.fromEntries(
    [...block.matchAll(/--color-slate-(\d+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1]!, m[2]!]),
  );
const LIGHT: Record<string, string> = {
  '50': '#f8fafc',
  '400': '#94a3b8',
  '500': '#64748b',
  '600': '#475569',
};
const darkBlock = theme.slice(
  theme.indexOf('\n.dark {'),
  theme.indexOf('}', theme.indexOf('\n.dark {')),
);
const DARK = { ...LIGHT, ...tokens(darkBlock) };

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r!) + 0.7152 * lin(g!) + 0.0722 * lin(b!);
}
const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
};

describe('the themed scrollbar', () => {
  const base = baseLayers(theme).find((b) => b.includes('scrollbar-color')) ?? '';

  it('is the default for every element, in the base layer so utilities outrank it', () => {
    expect(base).toMatch(/\*\s*\{[^}]*scrollbar-width:\s*thin/);
    expect(base).toMatch(/\*\s*\{[^}]*scrollbar-color:\s*var\(--color-slate-500\)\s+transparent/);
    expect(base).toMatch(/::-webkit-scrollbar-thumb\s*\{[^}]*var\(--color-slate-500\)/);
  });

  it('reaches 3:1 against every surface it sits on, in both appearances', () => {
    expect(contrast(LIGHT['500']!, '#ffffff')).toBeGreaterThanOrEqual(3);
    expect(contrast(LIGHT['500']!, LIGHT['50']!)).toBeGreaterThanOrEqual(3);
    for (const surface of ['800', '900', '950']) {
      expect(DARK[surface], `dark slate-${surface}`).toBeDefined();
      expect(
        contrast(DARK['500']!, DARK[surface]!),
        `on dark slate-${surface}`,
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it('is the only scrollbar styling in the source', () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        if (name === 'node_modules' || name.startsWith('.') || name === 'out' || name === 'dist')
          continue;
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.(tsx?|css)$/.test(name) && !name.endsWith('.test.ts')) {
          const text = readFileSync(path, 'utf8');
          const rel = relative(repo, path);
          if (rel === 'packages/tailwind-config/theme.css') continue;
          // A per-surface hide is allowed; any other webkit scrollbar styling
          // or a private scrollbar class is a second dialect.
          for (const m of text.matchAll(
            /::-webkit-scrollbar[\w-]*\]?:?(\w*)|\bscrollbar-thin\b/g,
          )) {
            if (m[0].startsWith('::-webkit-scrollbar]:hidden')) continue;
            offenders.push(`${rel}: ${m[0]}`);
          }
        }
      }
    };
    for (const root of ['apps', 'packages']) walk(join(repo, root));
    expect(offenders).toEqual([]);
  });
});
