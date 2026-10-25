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
import { parseSourceFiles } from '@liveworkspace/source-ast';
import { describe, expect, it } from 'vitest';
import { contrastRatio } from '@livedocuments/document';

// The dark palette (docs/specs/004-interface-design/color-scheme.md, Dark palette (Steel)) is a set of
// token overrides plus two class rules. None of it fails a build when it drifts: a new button painted
// `bg-brand-500 text-white` with no dark pairing renders, it just renders at 3.75:1 on dark chrome. So
// these read the source, the way dark-mode-coverage.test.ts does, and the Playwright contrast audit
// (e2e/contrast-audit.spec.ts) checks the screens a user actually sees.

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const REPO = resolve(ROOT, '../..') + '/';
// The shared theme (the monorepo's packages/tailwind-config), then this product's palette over it
// (packages/tailwind-config/theme.css): a later block's declarations win, as they do in the cascade.
const THEME_CSS = [
  `${REPO}../packages/tailwind-config/theme.css`,
  `${REPO}packages/tailwind-config/theme.css`,
]
  .map((path) => readFileSync(path, 'utf8'))
  .join('\n');

/** The declarations of every top-level rule whose selector is exactly `selector`, a later rule's winning. */
function block(css: string, selector: string): Record<string, string> {
  const opener = new RegExp(
    `(^|\\n)${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{`,
    'g',
  );
  const out: Record<string, string> = {};
  for (const { index } of css.matchAll(opener)) {
    const body = css.slice(css.indexOf('{', index) + 1, css.indexOf('}', index));
    for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[m[1]!] = m[2]!.trim();
  }
  return out;
}

const STEEL: Record<string, string> = {
  '50': '#faf5ee',
  '100': '#f4e9db',
  '200': '#ead5bc',
  '300': '#debf9b',
  '400': '#e0bb8f',
  '500': '#bf935b',
  '600': '#996d3a',
  '700': '#845e2f',
  '800': '#6b4c26',
  '900': '#533a1d',
  '950': '#382714',
};
// Light mode's ramp, which the dark palette must not touch (light-palette.test.ts guards its fills).
const AMBER: Record<string, string> = {
  '50': '#fffbeb',
  '100': '#fef3c7',
  '200': '#fde68a',
  '300': '#fcd34d',
  '400': '#fbbf24',
  '500': '#f59e0b',
  '600': '#c76508',
  '700': '#a34a0c',
  '800': '#92400e',
  '900': '#78350f',
  '950': '#451a03',
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
    for (const [stop, hex] of Object.entries(AMBER)) {
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
  // Every app's wordmark classes live in the shared logo package (packages/brand/src/apps.ts).
  const brand = readFileSync(`${REPO}../packages/brand/src/apps.ts`, 'utf8');

  it('lights its "live" half amber in dark mode, and is brand-700 in light (#74)', () => {
    expect(brand).toMatch(
      /livedocuments: \{(?:(?!\n  live)[\s\S])*?liveClass: 'text-brand-700 dark:text-amber-400'/,
    );
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
  // The shared design system (@liveworkspace/ui), which this app renders too.
  ...sourceFiles(`${REPO}../packages/ui/src`),
  // The editor code every editor shares (@liveworkspace/workbench), which this app renders too.
  ...sourceFiles(`${REPO}../packages/workbench/src`),
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

// The optical utilities and the optical guard live with optical-alignment.md: the monorepo's packages/tailwind-config
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
