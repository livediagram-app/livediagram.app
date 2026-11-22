import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SCHEME_ID, contrastRatio } from '@liveknowledge/document';
import { knowledgeLightGroundCss } from '@/hooks/ui/useEditorAccent';
import { knowledgeChromeAccent, knowledgeDarkGround } from '@/lib/knowledge-style/knowledge-accent';
import { THEMES } from '@/lib/themes';

// The chrome keeps its edges (docs/specs/030-knowledgebase/page-surface.md "The chrome keeps its edges"; owner
// 2026-11-21: "The everyday theme loses the borders on the sidebar and header etc so it all blends into one mess").
// The edges and the sidebar's surface are mixed from the ground in globals.css; this reads those mixes and works
// them out for every theme a knowledgebase can wear, in both appearances, so no look runs the chrome together.

const CSS = readFileSync(fileURLToPath(new URL('./globals.css', import.meta.url)), 'utf8');

// The light appearance's slate-900: Tailwind's oklch(20.8% 0.042 265.755), in sRGB.
const LIGHT_SLATE_900 = '#0f172b';

/** The declaration `name` in the top-level rules whose selector is exactly `selector`, the last one winning. */
function declared(selector: string, name: string): string {
  const opener = new RegExp(`(^|\\n)${selector.replace(/[.:()[\]]/g, '\\$&')}\\s*\\{`, 'g');
  let value: string | undefined;
  for (const { index } of CSS.matchAll(opener)) {
    const body = CSS.slice(CSS.indexOf('{', index) + 1, CSS.indexOf('}', index));
    const m = new RegExp(`${name}\\s*:\\s*([^;]+);`).exec(body);
    if (m) value = m[1]!.trim();
  }
  expect(value, `${selector} ${name}`).toBeTruthy();
  return value!;
}

/** `color-mix(in oklab, <ground var>, <other> N%)`: the other colour (a var or a hex) and its share. */
function mixOf(value: string): { other: string; share: number } {
  const m =
    /^color-mix\(in oklab, var\(--color-[\w-]+\), (var\(--color-[\w-]+\)|#[0-9a-f]{6}) (\d+)%\)$/.exec(
      value,
    );
  expect(m, value).toBeTruthy();
  return { other: m![1]!, share: Number(m![2]) / 100 };
}

// sRGB hex <-> oklab, as the browser mixes.
const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
function oklab(hex: string): [number, number, number] {
  const [r, g, b] = [1, 3, 5].map((i) => toLinear(parseInt(hex.slice(i, i + 2), 16) / 255)) as [
    number,
    number,
    number,
  ];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
function fromOklab([L, A, B]: [number, number, number]): string {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return `#${rgb
    .map((c) =>
      Math.round(Math.min(1, Math.max(0, toGamma(c))) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}
const mix = (ground: string, other: string, share: number): string => {
  const [a, b] = [oklab(ground), oklab(other)];
  return fromOklab(
    [0, 1, 2].map((i) => a[i]! * (1 - share) + b[i]! * share) as [number, number, number],
  );
};

/** The light ground under a theme: white, or the wash useEditorAccent writes for a theme's accent. */
function lightGround(theme: string): string {
  const accent = knowledgeChromeAccent(theme);
  if (!accent) return '#ffffff';
  return /--color-white:(#[0-9a-f]{6});/.exec(knowledgeLightGroundCss(accent))![1]!;
}

const THEME_IDS = [DEFAULT_SCHEME_ID, ...THEMES.map((t) => t.id)];
const otherHex = (other: string, dark: boolean): string =>
  other.startsWith('#') ? other : dark ? 'unused' : LIGHT_SLATE_900;

describe('the chrome keeps its edges', () => {
  it('paints the sidebar, the top row, the rail and the footer from the two mixes', () => {
    for (const [selector, prop] of [
      ['[data-contents-sidebar],\n[data-page-tree-over]', 'border-right-color'],
      ['[data-knowledge-top-row]', 'border-bottom-color'],
      ['[data-page-rail]', 'border-left-color'],
      ['[data-editor-tabbar]', 'border-top-color'],
    ] as const)
      expect(declared(selector, prop)).toBe('var(--lk-chrome-edge)');
    expect(declared('[data-contents-sidebar],\n[data-page-tree-over]', 'background-color')).toBe(
      'var(--lk-chrome-side)',
    );
  });

  for (const appearance of ['light', 'dark'] as const) {
    const dark = appearance === 'dark';
    const scope = dark ? '.dark' : ':root';
    const edge = mixOf(declared(scope, '--lk-chrome-edge'));
    const side = mixOf(declared(scope, '--lk-chrome-side'));
    // The dark mixes are toward white and black: never a var whose value a theme moves.
    if (dark) for (const m of [edge, side]) expect(m.other).toMatch(/^#/);

    it(`draws an edge and a sidebar off the ground under every theme, ${appearance}`, () => {
      for (const theme of THEME_IDS) {
        const ground = dark ? knowledgeDarkGround(theme) : lightGround(theme);
        const e = contrastRatio(mix(ground, otherHex(edge.other, dark), edge.share), ground);
        const s = contrastRatio(mix(ground, otherHex(side.other, dark), side.share), ground);
        expect(e, `${theme} edge`).toBeGreaterThanOrEqual(1.3);
        expect(s, `${theme} sidebar`).toBeGreaterThanOrEqual(1.06);
        // The sidebar stays quieter than its own edge.
        expect(s, `${theme} sidebar under its edge`).toBeLessThan(e);
      }
    });
  }

  it('was needed: the slate stops it replaces ran Everyday together in the dark', () => {
    // The shared dark palette's slate-800 border on its slate-900 ground (packages/tailwind-config/theme.css `.dark`).
    expect(contrastRatio('#16202e', knowledgeDarkGround(DEFAULT_SCHEME_ID))).toBeLessThan(1.1);
  });
});
