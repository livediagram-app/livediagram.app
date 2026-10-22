import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MOTION_TOKENS, formatViolations, scanStylesheet } from './motion-budget';

// The shared theme is chrome for every app that imports it
// (docs/specs/004-interface-design/motion.md), so it is held to the budget itself.
describe('shared theme motion', () => {
  it('keeps every chrome duration within the budget', () => {
    const css = readFileSync(new URL('../theme.css', import.meta.url), 'utf8');
    expect(formatViolations(scanStylesheet(css, 'theme.css', MOTION_TOKENS))).toBe('');
  });
});

// The editor's header, tab bar and logo keep the app's own colours whatever the tab's style
// (docs/specs/011-theme/canvas-and-theme-dialog.md "The app's chrome"): their block re-declares the palettes, so it
// must stay equal to them.
describe('app chrome palette', () => {
  const css = readFileSync(new URL('../theme.css', import.meta.url), 'utf8');
  const vars = (selector: string): Record<string, string> => {
    const start = css.indexOf(`\n${selector} {`);
    const body = css.slice(start, css.indexOf('\n}', start));
    return Object.fromEntries(
      [...body.matchAll(/--color-((?:brand|slate)-\d+):\s*([^;]+);/g)].map(
        (m): [string, string] => [m[1]!, m[2]!],
      ),
    );
  };
  const brandOf = (v: Record<string, string>) =>
    Object.fromEntries(Object.entries(v).filter(([k]) => k.startsWith('brand-')));

  it('re-declares the light brand ramp as @theme sets it', () => {
    expect(vars('[data-app-chrome]')).toEqual(brandOf(vars('@theme')));
  });

  it('re-declares the dark brand ramp and surfaces as .dark sets them', () => {
    const chrome = vars('.dark [data-app-chrome]');
    const dark = vars('.dark');
    expect(brandOf(chrome)).toEqual(brandOf(dark));
    for (const [k, v] of Object.entries(dark))
      if (k.startsWith('slate-')) expect(chrome[k]).toBe(v);
    expect(
      Object.keys(chrome)
        .filter((k) => k.startsWith('slate-'))
        .sort(),
    ).toEqual(['slate-600', 'slate-700', 'slate-800', 'slate-900', 'slate-950']);
  });
});
