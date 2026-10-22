import { APP_SITES } from '@liveworkspace/sites';
import { describe, expect, it } from 'vitest';
import { APP_COPY, listedApps } from './apps';

describe('the apps on liveworkspace.app', () => {
  it('has copy for every app in the shared list, so no card ships empty', () => {
    for (const site of APP_SITES) expect(APP_COPY[site.id], site.id).toBeDefined();
    expect(listedApps().map((a) => a.id)).toEqual(APP_SITES.map((s) => s.id));
  });

  it('links each app’s privacy policy on its own site', () => {
    for (const app of listedApps()) expect(new URL(app.privacy).origin).toBe(app.url);
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
    for (const app of listedApps()) {
      const contrast = 1.05 / (luminance(app.deep) + 0.05);
      expect(contrast, app.id).toBeGreaterThanOrEqual(4.5);
    }
  });
});
