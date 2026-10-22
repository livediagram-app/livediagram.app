import { TEMPLATES } from '@liveplanner/templates';
import { describe, expect, it } from 'vitest';
import { HERO_SCENES } from './hero-scenes';

// Each hero scene's window shows the mode its "build yours" link names, and a scene that searches
// for a template searches for one the catalogue lists.
// The modes are the hero's own illustrative ones (HeroMode) until the site is redesigned.
describe('hero scenes', () => {
  it.each(HERO_SCENES.map((s) => [s.key, s] as const))(
    '%s links to the mode its window shows',
    (_, scene) => {
      const url = new URL(scene.build, 'https://liveplanner.app');
      expect(url.pathname).toBe('/new');
      expect(url.searchParams.get('mode')).toBe(scene.mode);
    },
  );

  it.each(
    HERO_SCENES.filter((s) =>
      new URL(s.build, 'https://liveplanner.app').searchParams.has('q'),
    ).map((s) => [s.key, s] as const),
  )('%s searches for a template the catalogue lists', (_, scene) => {
    const q = new URL(scene.build, 'https://liveplanner.app').searchParams.get('q')!.toLowerCase();
    const match = TEMPLATES.filter((t) => !t.hidden && t.title.toLowerCase().includes(q));
    expect(match.length, `a "${q}" template`).toBeGreaterThan(0);
  });
});
