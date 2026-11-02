import { TEMPLATES, templateEditorMode } from '@livehuddle/templates';
import { describe, expect, it } from 'vitest';
import { HERO_SCENES } from './hero-scenes';

// Each hero scene's "build yours" link opens the template step, and a scene that searches for a
// template finds one in the mode its window shows (every template opens in Workshop,
// docs/specs/012-collaboration/workshop-mode.md), so the mock never wears a mode the editor
// would not show.
describe('hero scenes', () => {
  it.each(HERO_SCENES.map((s) => [s.key, s] as const))(
    '%s links to the template step',
    (_, scene) => {
      const url = new URL(scene.build, 'https://www.livehuddle.app');
      expect(url.pathname).toBe('/new');
      expect(url.searchParams.has('mode')).toBe(false);
    },
  );

  it.each(
    HERO_SCENES.filter((s) =>
      new URL(s.build, 'https://www.livehuddle.app').searchParams.has('q'),
    ).map((s) => [s.key, s] as const),
  )('%s searches for a template that opens in its mode', (_, scene) => {
    const q = new URL(scene.build, 'https://www.livehuddle.app').searchParams
      .get('q')!
      .toLowerCase();
    const match = TEMPLATES.filter(
      (t) =>
        !t.hidden && t.title.toLowerCase().includes(q) && templateEditorMode(t.kind) === scene.mode,
    );
    expect(match.length, `a "${q}" template in ${scene.mode}`).toBeGreaterThan(0);
  });
});
