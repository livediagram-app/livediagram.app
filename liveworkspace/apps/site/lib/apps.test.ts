import { APP_SITES } from '@liveworkspace/sites';
import { describe, expect, it } from 'vitest';
import { APP_COPY, listedApps, pageApps, UPCOMING_APPS } from './apps';

describe('the apps on liveworkspace.app', () => {
  it('has copy for every app in the shared list, so no card ships empty', () => {
    for (const site of APP_SITES) expect(APP_COPY[site.id], site.id).toBeDefined();
    expect(listedApps().map((a) => a.id)).toEqual(APP_SITES.map((s) => s.id));
  });
});

// WCAG relative luminance and contrast, for the deep shade's promise.
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

describe('each app’s deep shade', () => {
  it('takes white text, and reads on white, at WCAG AA', () => {
    for (const app of pageApps()) {
      const contrast = 1.05 / (luminance(app.deep) + 0.05);
      expect(contrast, app.domain).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('the apps on their way', () => {
  it('are not listed as live anywhere yet', () => {
    const live = new Set<string>(APP_SITES.map((s) => s.id));
    for (const app of UPCOMING_APPS) expect(live.has(app.domain), app.domain).toBe(false);
  });

  it('follow the live apps on the page, with no way in', () => {
    const apps = pageApps();
    expect(apps.map((a) => a.domain)).toEqual([
      ...APP_SITES.map((s) => s.id),
      ...UPCOMING_APPS.map((a) => a.domain),
    ]);
    for (const app of apps.slice(APP_SITES.length)) expect(app.url).toBeNull();
  });
});
