import { describe, expect, it } from 'vitest';
import { listedApps } from '@/lib/apps';
import { appLogoInks, brandAppOf } from './AppLogo';

// An app's logo on the site (the home page, Comparison, the legal pages, the footer): "live" is real text, so in dark
// mode its ink meets WCAG AA on the darkest-but-one card the site sets it on (slate-800), not only on the page.
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
const ratio = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};

const SLATE_800 = '#1e293b';

describe('AppLogo', () => {
  it('inks "live" at AA on a dark card for every app', () => {
    const apps = listedApps();
    expect(apps.length).toBeGreaterThan(0);
    for (const app of apps) {
      const brand = brandAppOf(app.id);
      if (!brand) continue;
      const inks = appLogoInks(app, brand) as Record<string, string>;
      for (const name of [
        '--color-sky-400',
        '--color-violet-400',
        '--color-amber-400',
        '--color-rose-400',
      ])
        expect(ratio(inks[name]!, SLATE_800), `${app.id} ${name}`).toBeGreaterThanOrEqual(4.5);
      expect(
        ratio(inks['--color-brand-700']!, '#ffffff'),
        `${app.id} light`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });
});
