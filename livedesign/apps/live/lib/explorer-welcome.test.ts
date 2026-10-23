import { describe, expect, it } from 'vitest';
import file from '@livedesign/templates/welcome.json';
import { loadWelcome, welcomeManifest } from './explorer-welcome';

describe("livedesign's first-run welcome", () => {
  it('offers blanks and templates made here, and searches the New wizard', () => {
    const manifest = welcomeManifest(file);
    expect(manifest.name).toBe('livedesign');
    expect(manifest.blanks.length).toBeGreaterThan(0);
    expect(manifest.popular.length).toBeGreaterThan(0);
    for (const start of [...manifest.blanks, ...manifest.popular])
      expect(start.href).toMatch(/^\/new\?/);
    expect(manifest.searchHref('logo mark')).toBe('/new?q=logo%20mark');
  });

  it('loads once', async () => {
    const [a, b] = await Promise.all([loadWelcome(), loadWelcome()]);
    expect(a).not.toBeNull();
    expect(a).toBe(b);
  });
});
