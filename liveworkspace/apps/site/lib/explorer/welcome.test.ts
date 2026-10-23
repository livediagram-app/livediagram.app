import { describe, expect, it } from 'vitest';
import { absoluteWelcome, loadWelcome, type WelcomeFile } from './welcome';

describe("Home's first run on liveworkspace.app", () => {
  it("makes every start's address the app's own", () => {
    const file: WelcomeFile = {
      app: 'liveplanner',
      pillFree: 'Free',
      startBlankHref: '/new?start=blank',
      allTemplatesHref: '/new',
      searchHref: '/new?q=',
      fan: ['a'],
      blanks: [{ id: 'a', name: 'A', href: '/new?template=a' }],
      popular: [],
    };
    const m = absoluteWelcome('liveplanner', file);
    expect(m.name).toBe('liveplanner');
    expect(m.blanks[0]!.href).toBe('https://www.liveplanner.app/new?template=a');
    expect(m.startBlankHref).toBe('https://www.liveplanner.app/new?start=blank');
    expect(m.searchHref('road map')).toBe('https://www.liveplanner.app/new?q=road%20map');
  });

  it("loads each app's manifest, with its starts", async () => {
    for (const app of ['livediagram', 'liveplanner', 'livedocuments', 'livedesign'] as const) {
      const m = await loadWelcome(app);
      expect(m?.blanks.length).toBeGreaterThan(0);
      expect(m?.popular.length).toBeLessThanOrEqual(8);
    }
  });
});
