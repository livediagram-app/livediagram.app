import { readFileSync, readdirSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isIdentifier,
  isJsxAttribute,
  isJsxOpeningElement,
  isJsxSelfClosingElement,
  isNoSubstitutionTemplateLiteral,
  isStringLiteral,
  isTemplateExpression,
  type JsxAttribute,
  type Node,
  type SourceFile,
} from 'typescript/unstable/ast';
import { parseSourceFiles } from '@livedesign/source-ast';
import { describe, expect, it } from 'vitest';
import { contrastRatio } from '@livedesign/document';

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
  '50': '#faeef0',
  '100': '#f4dbdf',
  '200': '#eabcc4',
  '300': '#de9ba6',
  '400': '#e08f9d',
  '500': '#bf5b6c',
  '600': '#993a4a',
  '700': '#842f3e',
  '800': '#6b2632',
  '900': '#531d26',
  '950': '#38141a',
};
// Light mode's ramp, which the dark palette must not touch (light-palette.test.ts guards its fills).
const ROSE: Record<string, string> = {
  '50': '#fff1f2',
  '100': '#ffe4e6',
  '200': '#fecdd3',
  '300': '#fda4af',
  '400': '#fb7185',
  '500': '#f43f5e',
  '600': '#e11d48',
  '700': '#be123c',
  '800': '#9f1239',
  '900': '#881337',
  '950': '#4c0519',
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
    for (const [stop, hex] of Object.entries(ROSE)) {
      expect(light[`--color-brand-${stop}`], `brand-${stop}`).toBe(hex);
    }
  });
});

// Explorer: Midnight (color-scheme.md "Explorer: Midnight"): the Explorer's own dark tokens, held to Steel's rules.
describe('the Explorer Midnight tokens', () => {
  const midnight = block(THEME_CSS, ".dark[data-palette='midnight']");
  const token = (name: string) => midnight[`--color-${name}`]!;

  it('paints the Explorer in the navy surfaces', () => {
    expect(token('slate-950')).toBe('#070b1a');
    expect(token('slate-900')).toBe('#0a0f24');
    expect(token('slate-800')).toBe('#111833');
    expect(token('slate-700')).toBe('#1f2a55');
  });

  it('keeps secondary and brand text at 4.5:1 on the page and on a card', () => {
    for (const ground of ['slate-900', 'slate-800']) {
      expect(
        contrastRatio(token('slate-400'), token(ground)),
        `slate-400 on ${ground}`,
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(token('brand-400'), token(ground)),
        `brand-400 on ${ground}`,
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(token('brand-300'), token(ground)),
        `brand-300 on ${ground}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps white on the solid fill at 4.5:1 and a selected segment at 3:1 on its track', () => {
    expect(contrastRatio('#ffffff', token('brand-600'))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio('#ffffff', token('brand-700'))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(token('brand-600'), token('slate-950'))).toBeGreaterThanOrEqual(3);
  });

  it('defines every stop it retargets, so no Steel value leaks through', () => {
    for (const stop of [
      '50',
      '100',
      '200',
      '300',
      '400',
      '500',
      '600',
      '700',
      '800',
      '900',
      '950',
    ]) {
      expect(midnight[`--color-brand-${stop}`], `brand-${stop}`).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

describe('the wordmark', () => {
  const brand = readFileSync(`${REPO}packages/ui/src/Brand.tsx`, 'utf8');

  it('lights its "live" half rose in dark mode, and is brand-700 in light (#74)', () => {
    expect(brand).toMatch(/'text-brand-700 dark:text-rose-400'/);
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
const PARSED = parseSourceFiles(SOURCES);

/**
 * Every class-bearing string in a file: each string literal on its own, and each template
 * literal as a whole (its static chunks joined, with an interpolated identifier kept by name,
 * so `${SOLID_BRAND_DARK}` counts as the pairing it stands for).
 */
function classStrings(source: SourceFile): { path: string; text: string }[] {
  const path = source.fileName;
  const out: { path: string; text: string }[] = [];
  const visit = (node: Node): void => {
    if (isStringLiteral(node) || isNoSubstitutionTemplateLiteral(node)) {
      out.push({ path, text: node.text });
    } else if (isTemplateExpression(node)) {
      const parts = [node.head.text];
      for (const span of node.templateSpans) {
        parts.push(isIdentifier(span.expression) ? span.expression.text : '');
        parts.push(span.literal.text);
      }
      out.push({ path, text: parts.join(' ') });
    }
    node.forEachChild(visit);
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
      const visit = (node: Node): void => {
        if (isJsxOpeningElement(node) || isJsxSelfClosingElement(node)) {
          const attr = (name: string) =>
            node.attributes.properties.find(
              (p): p is JsxAttribute => isJsxAttribute(p) && p.name.getText(sf) === name,
            );
          const cls = attr('className')?.initializer?.getText(sf) ?? '';
          const style = attr('style')?.initializer?.getText(sf) ?? '';
          // A literal (a quoted string, after any spaces) is not a runtime colour.
          const runtimeBg = /backgroundColor:\s*(?![\s'"`])/.test(style);
          if (runtimeBg && /(^|[\s'"`{])text-white\b/.test(cls)) {
            offenders.push(
              `${relative(REPO, path)}:${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1}`,
            );
          }
        }
        node.forEachChild(visit);
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
