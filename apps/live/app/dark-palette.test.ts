import { readFileSync, readdirSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

// The dark palette (docs/specs/004-interface-design/color-scheme.md, Dark palette (Steel)) is a set of
// token overrides plus two class rules. None of it fails a build when it drifts: a new button painted
// `bg-brand-500 text-white` with no dark pairing renders, it just renders at 3.75:1 on dark chrome. So
// these read the source, the way dark-mode-coverage.test.ts does, and the Playwright contrast audit
// (e2e/contrast-audit.spec.ts) checks the screens a user actually sees.

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const REPO = resolve(ROOT, '../..') + '/';
const THEME_CSS = readFileSync(`${REPO}packages/tailwind-config/theme.css`, 'utf8');

/** The declarations of the first top-level rule whose selector is exactly `selector`. */
function block(css: string, selector: string): Record<string, string> {
  const at = css.search(
    new RegExp(`(^|\\n)${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{`),
  );
  if (at < 0) return {};
  const body = css.slice(css.indexOf('{', at) + 1, css.indexOf('}', at));
  return Object.fromEntries(
    [...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1]!, m[2]!.trim()]),
  );
}

const STEEL: Record<string, string> = {
  '50': '#eef3fa',
  '100': '#dbe6f4',
  '200': '#bcd0ea',
  '300': '#9bb9de',
  '400': '#8fb3e0',
  '500': '#5b86bf',
  '600': '#3a6599',
  '700': '#2f5484',
  '800': '#26446b',
  '900': '#1d3553',
  '950': '#142538',
};
// Light mode's ramp, which the dark palette must not touch (the light half of #74 is not ours).
const SKY: Record<string, string> = {
  '50': '#f0f9ff',
  '100': '#e0f2fe',
  '200': '#bae6fd',
  '300': '#7dd3fc',
  '400': '#38bdf8',
  '500': '#0ea5e9',
  '600': '#0284c7',
  '700': '#0369a1',
  '800': '#075985',
  '900': '#0c4a6e',
  '950': '#082f49',
};

describe('the dark palette tokens', () => {
  const dark = block(THEME_CSS, '.dark');

  it('paints the chrome in the blue-slate surfaces', () => {
    expect(dark['--color-slate-950']).toBe('#0b0f16');
    expect(dark['--color-slate-900']).toBe('#131b26');
    expect(dark['--color-slate-800']).toBe('#16202e');
  });

  it('retargets the brand ramp to Steel', () => {
    for (const [stop, hex] of Object.entries(STEEL)) {
      expect(dark[`--color-brand-${stop}`], `brand-${stop}`).toBe(hex);
    }
  });

  it('leaves the light ramp exactly as it was', () => {
    const light = block(THEME_CSS, '@theme');
    for (const [stop, hex] of Object.entries(SKY)) {
      expect(light[`--color-brand-${stop}`], `brand-${stop}`).toBe(hex);
    }
  });
});

describe('the wordmark', () => {
  const brand = readFileSync(`${REPO}packages/ui/src/Brand.tsx`, 'utf8');

  it('lights its "live" half sky in dark mode, and keeps brand-600 in light', () => {
    expect(brand).toMatch(/'text-brand-600 dark:text-sky-400'/);
  });
});

// ---- class-string rules -------------------------------------------------------------------------

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (['node_modules', '.next', '.next-dev', 'out', 'dist', '.turbo', 'e2e'].includes(entry))
      continue;
    const full = `${dir}/${entry}`;
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.tsx?$/.test(entry) && !entry.includes('.test.')) out.push(full);
  }
  return out;
}

const SOURCES = [
  ...['app', 'components', 'hooks', 'lib'].flatMap((d) => sourceFiles(`${ROOT}${d}`)),
  ...sourceFiles(`${REPO}packages/ui/src`),
];

// Parsed once, here at collection time, and shared by every rule below: re-parsing ~900 files
// inside a test spent seconds of its timeout on a busy CI runner.
const PARSED = SOURCES.map((path) =>
  ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true),
);

/**
 * Every class-bearing string in a file: each string literal on its own, and each template
 * literal as a whole (its static chunks joined, with an interpolated identifier kept by name,
 * so `${SOLID_BRAND_DARK}` counts as the pairing it stands for).
 */
function classStrings(source: ts.SourceFile): { path: string; text: string }[] {
  const path = source.fileName;
  const out: { path: string; text: string }[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      out.push({ path, text: node.text });
    } else if (ts.isTemplateExpression(node)) {
      const parts = [node.head.text];
      for (const span of node.templateSpans) {
        parts.push(ts.isIdentifier(span.expression) ? span.expression.text : '');
        parts.push(span.literal.text);
      }
      out.push({ path, text: parts.join(' ') });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return out.map((s) => ({ ...s, path: relative(REPO, s.path) }));
}

const STRINGS = PARSED.flatMap(classStrings);
const tokens = (text: string) => text.split(/\s+/).filter(Boolean);
const PAIRING = /^(SOLID_BRAND_DARK|SOLID_BRAND_DARK_CONTROL|dark:bg-brand-600)$/;

describe('solid brand fills in dark mode', () => {
  it('carry the brand-600 pairing wherever white text sits on a solid brand fill', () => {
    const offenders = STRINGS.filter(({ text }) => {
      const t = tokens(text);
      const solid = t.some((x) => /^((group-)?hover:)?bg-brand-(500|600)$/.test(x));
      return solid && t.includes('text-white') && !t.some((x) => PAIRING.test(x));
    }).map(({ path, text }) => `${path}: ${text.slice(0, 90)}`);
    expect(offenders).toEqual([]);
  });
});

describe('brand-coloured text in dark mode', () => {
  it('always names a dark counterpart', () => {
    const offenders = STRINGS.filter(({ text }) => {
      const t = tokens(text);
      return (
        t.some((x) => /^text-brand-(500|600|700|800|900|950)$/.test(x)) &&
        !t.some((x) => /^dark:text-/.test(x))
      );
    }).map(({ path, text }) => `${path}: ${text.slice(0, 90)}`);
    expect(offenders).toEqual([]);
  });
});

// The optical utilities and the optical guard live with optical-alignment.md: packages/tailwind-config
// (optical-utilities.test.ts) and each workspace's optical-guard.test.ts.

// White text on an identity colour (docs/specs/004-interface-design/color-scheme.md, Dark palette rules):
// a colour taken at runtime (a participant's, a team's) is painted through identityVars + IDENTITY_FILL,
// never an inline backgroundColor, so dark mode can deepen it under the white text.
describe('white text on an identity colour', () => {
  it('never sits on an inline runtime background, which the dark shade could not override', () => {
    const offenders: string[] = [];
    // An offender carries both tokens, so a file missing either has none to walk.
    const candidates = PARSED.filter(
      (sf) =>
        sf.fileName.endsWith('.tsx') &&
        sf.text.includes('backgroundColor') &&
        sf.text.includes('text-white'),
    );
    for (const sf of candidates) {
      const path = sf.fileName;
      const visit = (node: ts.Node): void => {
        if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
          const attr = (name: string) =>
            node.attributes.properties.find(
              (p): p is ts.JsxAttribute => ts.isJsxAttribute(p) && p.name.getText(sf) === name,
            );
          const cls = attr('className')?.initializer?.getText(sf) ?? '';
          const style = attr('style')?.initializer?.getText(sf) ?? '';
          const runtimeBg = /backgroundColor:\s*(?!['"`])/.test(style);
          if (runtimeBg && /(^|[\s'"`{])text-white\b/.test(cls)) {
            offenders.push(
              `${relative(REPO, path)}:${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1}`,
            );
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(sf);
    }
    expect(offenders).toEqual([]);
  });
});

// Secondary text in dark mode is slate-400 (docs/specs/004-interface-design/color-scheme.md, Dark palette
// rules): slate-500 as text is 3.4 to 3.9:1 on every dark surface.
describe('secondary text in dark mode', () => {
  it('is never slate-500', () => {
    const offenders = STRINGS.filter(({ text }) =>
      tokens(text).some((t) => /^dark:(placeholder:)?text-slate-500(\/\d+)?$/.test(t)),
    ).map(({ path, text }) => `${path}: ${text.slice(0, 90)}`);
    expect(offenders).toEqual([]);
  });
});
