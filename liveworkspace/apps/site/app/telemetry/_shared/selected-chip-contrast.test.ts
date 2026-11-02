import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrastRatio } from './colour-maths';

// The selected view tab and window chip (ViewTabs, StickyWindowBar) are white text on the app's brand fill, in light
// and dark alike. The fill is brand-700 in both: brand-600 is too pale for white in livediagram's sky (4.1:1) and
// livedocuments' amber (3.2:1).
const read = (file: string) => readFileSync(new URL(file, import.meta.url), 'utf8');
const css = read('../telemetry.css');
const theme = readFileSync(
  new URL('../../../../../../packages/tailwind-config/theme.css', import.meta.url),
  'utf8',
);

// Every brand-700 a dashboard can paint: the shared theme's default, and each app's own scale.
function brand700s(): string[] {
  const out: string[] = [];
  const themeBlock = theme.slice(theme.indexOf('@theme {'));
  for (const source of [themeBlock.slice(0, themeBlock.indexOf('}') + 1), css]) {
    let at = source.indexOf('--color-brand-700:');
    while (at !== -1) {
      const start = source.indexOf('#', at);
      out.push(source.slice(start, start + 7));
      at = source.indexOf('--color-brand-700:', at + 1);
    }
  }
  return out;
}

describe('the telemetry dashboard’s selected chips', () => {
  it('fill with brand-700 in dark too, never the paler brand-600', () => {
    for (const file of ['./ViewTabs.tsx', './StickyWindowBar.tsx']) {
      const source = read(file);
      expect(source, file).toContain("'bg-brand-700 text-white shadow-sm'");
      expect(source, file).not.toContain('dark:bg-brand-600');
    }
  });

  it('carry white text at WCAG AA on every app’s brand-700', () => {
    const fills = brand700s();
    expect(fills.length).toBeGreaterThanOrEqual(4);
    for (const fill of fills)
      expect(contrastRatio('#ffffff', fill), fill).toBeGreaterThanOrEqual(4.5);
  });
});
