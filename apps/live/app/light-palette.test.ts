import { readFileSync, readdirSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

// White text on a solid brand fill, in light mode (docs/specs/004-interface-design/color-scheme.md, Usage
// rules): the fill is brand-700, hovering to brand-800. On the sky ramp white reads 2.8:1 on brand-500 and
// 4.1:1 on brand-600, both under WCAG 2.2 AA's 4.5:1, and nothing fails a build when a new button is painted
// `bg-brand-500 text-white`. So this reads the source of every app and package, the way dark-palette.test.ts
// does for the dark half.

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const REPO = resolve(ROOT, '../..') + '/';
const THEME_CSS = readFileSync(`${REPO}packages/tailwind-config/theme.css`, 'utf8');

/** The `--color-brand-*` declarations of the light `@theme` block. */
function lightBrand(): Record<string, string> {
  const at = THEME_CSS.search(/(^|\n)@theme\s*\{/);
  const body = THEME_CSS.slice(THEME_CSS.indexOf('{', at) + 1, THEME_CSS.indexOf('}', at));
  return Object.fromEntries(
    [...body.matchAll(/--color-brand-(\d+)\s*:\s*([^;]+);/g)].map((m) => [m[1]!, m[2]!.trim()]),
  );
}

/** WCAG 2.2 relative luminance of a `#rrggbb` colour. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/** WCAG 2.2 contrast ratio of white text on `hex`. */
const whiteOn = (hex: string) => 1.05 / (luminance(hex) + 0.05);

describe('the light brand ramp under white text', () => {
  const brand = lightBrand();

  it('clears AA on the fill and its hover', () => {
    expect(whiteOn(brand['700']!)).toBeGreaterThanOrEqual(4.5);
    expect(whiteOn(brand['800']!)).toBeGreaterThanOrEqual(4.5);
  });

  it('fails AA on brand-500 and brand-600, which is why neither carries white text', () => {
    expect(whiteOn(brand['500']!)).toBeLessThan(4.5);
    expect(whiteOn(brand['600']!)).toBeLessThan(4.5);
  });
});

// ---- class-string rule --------------------------------------------------------------------------

const SKIP = new Set([
  'node_modules',
  '.next',
  '.next-dev',
  '.next-analyze',
  '.turbo',
  '.wrangler',
  'out',
  'dist',
  'e2e',
  'public',
]);

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const full = `${dir}/${entry}`;
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.tsx?$/.test(entry) && !/\.(test|spec)\./.test(entry)) out.push(full);
  }
  return out;
}

// Only a file holding both halves can hold an offender, so the rest are never parsed.
const CANDIDATES = ['apps', 'packages']
  .flatMap((top) => readdirSync(`${REPO}${top}`).map((name) => `${REPO}${top}/${name}`))
  .filter((dir) => statSync(dir).isDirectory())
  .flatMap((dir) => sourceFiles(dir))
  .map((path) => ({ path, text: readFileSync(path, 'utf8') }))
  .filter(({ text }) => text.includes('text-white') && /bg-brand-(500|600)\b/.test(text));

/** Each string literal on its own, and each template literal with its static chunks joined. */
function classStrings(path: string, text: string): { path: string; text: string }[] {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  const out: { path: string; text: string }[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      out.push({ path, text: node.text });
    } else if (ts.isTemplateExpression(node)) {
      out.push({
        path,
        text: [node.head.text, ...node.templateSpans.map((s) => s.literal.text)].join(' '),
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return out.map((s) => ({ ...s, path: relative(REPO, s.path) }));
}

const STRINGS = CANDIDATES.flatMap(({ path, text }) => classStrings(path, text));
const tokens = (text: string) => text.split(/\s+/).filter(Boolean);
/** A light-mode utility (no `dark:` variant), with any other variant (`hover:`, `group-hover:`…). */
const light = (re: RegExp) => (token: string) => !token.includes('dark:') && re.test(token);

describe('solid brand fills in light mode', () => {
  it('scans a real candidate set', () => {
    expect(CANDIDATES.length).toBeGreaterThan(0);
  });

  it('never put white text on brand-500 or brand-600', () => {
    const offenders = STRINGS.filter(({ text }) => {
      const t = tokens(text);
      return t.some(light(/(^|:)bg-brand-(500|600)$/)) && t.some(light(/(^|:)text-white$/));
    }).map(({ path, text }) => `${path}: ${text.slice(0, 90)}`);
    expect(offenders).toEqual([]);
  });
});
