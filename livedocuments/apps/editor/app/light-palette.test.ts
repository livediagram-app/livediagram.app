import { readFileSync, readdirSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isNoSubstitutionTemplateLiteral,
  isStringLiteral,
  isTemplateExpression,
  type Node,
  type SourceFile,
} from 'typescript/unstable/ast';
import { parseSourceFiles } from '@liveworkspace/source-ast';
import { describe, expect, it } from 'vitest';

// White text on a solid brand fill, in light mode (docs/specs/004-interface-design/color-scheme.md, Usage
// rules): the fill is brand-700, hovering to brand-800. On the amber ramp white reads 2.2:1 on brand-500 and
// 4.0:1 on brand-600, both under WCAG 2.2 AA's 4.5:1, and nothing fails a build when a new button is painted
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

/** WCAG 2.2 contrast ratio of white text on `hex`, which is also `hex` text on white. */
const whiteOn = (hex: string) => 1.05 / (luminance(hex) + 0.05);

/** WCAG 2.2 contrast ratio between two `#rrggbb` colours. */
function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

describe('the light brand ramp under white text', () => {
  const brand = lightBrand();

  it('clears AA on the fill and its hover', () => {
    expect(whiteOn(brand['700']!)).toBeGreaterThanOrEqual(4.5);
    expect(whiteOn(brand['800']!)).toBeGreaterThanOrEqual(4.5);
  });

  // A banner's 90% white copy sits on brand-700 (color-scheme.md), so the fill holds white at 5.9:1, not just
  // 4.5:1. Tailwind's amber-700 is 5.0:1, which is why the ramp's 700 is hand-tuned.
  it("holds white at 5.9:1 on the fill, so a banner's 90% white copy still clears AA", () => {
    expect(whiteOn(brand['700']!)).toBeGreaterThanOrEqual(5.9);
  });

  // brand-600 is the focus outline (menus.md, Accessibility), held to 3:1 on the grounds it is drawn over. Tailwind's
  // amber-600 is 2.9:1 on slate-100 and brand-100, which is why the ramp's 600 is hand-tuned too.
  it('holds the brand-600 focus outline at 3:1 on white, slate-100 and brand-100', () => {
    for (const ground of ['#ffffff', '#f1f5f9', brand['100']!]) {
      expect(ratio(brand['600']!, ground), ground).toBeGreaterThanOrEqual(3);
    }
  });

  it('fails AA on brand-500 and brand-600, which is why neither carries white text', () => {
    expect(whiteOn(brand['500']!)).toBeLessThan(4.5);
    expect(whiteOn(brand['600']!)).toBeLessThan(4.5);
  });
});

describe('light brand ink', () => {
  const brand = lightBrand();

  it('clears AA in brand-700 on white and on the brand tints it sits on', () => {
    for (const ground of ['#ffffff', brand['50']!, brand['100']!]) {
      expect(ratio(brand['700']!, ground)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('fails AA in brand-500 and brand-600 on white, which is why neither is text', () => {
    expect(ratio(brand['500']!, '#ffffff')).toBeLessThan(4.5);
    expect(ratio(brand['600']!, '#ffffff')).toBeLessThan(4.5);
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

const SOURCES = ['apps', 'packages']
  .flatMap((top) => readdirSync(`${REPO}${top}`).map((name) => `${REPO}${top}/${name}`))
  .filter((dir) => statSync(dir).isDirectory())
  .flatMap((dir) => sourceFiles(dir))
  .map((path) => ({ path, text: readFileSync(path, 'utf8') }));

// Only a file holding both halves can hold an offender, so the rest are never parsed.
const CANDIDATES = SOURCES.filter(
  ({ text }) => text.includes('text-white') && /bg-brand-(500|600)\b/.test(text),
);

/** Each string literal on its own, and each template literal with its static chunks joined. */
function classStrings(source: SourceFile): { path: string; text: string }[] {
  const path = source.fileName;
  const out: { path: string; text: string }[] = [];
  const visit = (node: Node): void => {
    if (isStringLiteral(node) || isNoSubstitutionTemplateLiteral(node)) {
      out.push({ path, text: node.text });
    } else if (isTemplateExpression(node)) {
      out.push({
        path,
        text: [node.head.text, ...node.templateSpans.map((s) => s.literal.text)].join(' '),
      });
    }
    node.forEachChild(visit);
  };
  visit(source);
  return out.map((s) => ({ ...s, path: relative(REPO, s.path) }));
}

const STRINGS = parseSourceFiles(CANDIDATES.map(({ path }) => path)).flatMap(classStrings);
const INK_STRINGS = parseSourceFiles(
  SOURCES.filter(({ text }) => /text-brand-(500|600)\b/.test(text)).map(({ path }) => path),
).flatMap(classStrings);
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

// Brand-coloured ink that carries no meaning a reader needs, so the contrast minimum does not apply
// (WCAG 1.4.3 and 1.4.11 exempt pure decoration). Everything else in light brand ink is brand-700.
const DECORATIVE_INK = new Set([
  'apps/editor/components/canvas/TabLoadOverlay.tsx', // the loading spinner's arc
  'apps/editor/components/canvas/PaletteDragGhost.tsx', // the translucent ghost under a drag
  'apps/editor/components/plan/dashboard/DashboardSheetMetric.tsx', // an aria-hidden sparkline
]);

describe('brand ink in light mode', () => {
  it('scans a real candidate set', () => {
    expect(INK_STRINGS.length).toBeGreaterThan(0);
  });

  it('is brand-700, never brand-500 or brand-600, outside decoration', () => {
    const offenders = INK_STRINGS.filter(
      ({ path, text }) =>
        !DECORATIVE_INK.has(path) && tokens(text).some(light(/(^|:)text-brand-(500|600)$/)),
    ).map(({ path, text }) => `${path}: ${text.slice(0, 90)}`);
    expect(offenders).toEqual([]);
  });
});
