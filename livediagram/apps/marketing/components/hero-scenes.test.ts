import { TEMPLATES, templateEditorMode } from '@livediagram/templates';
import { describe, expect, it } from 'vitest';
import { HERO_SCENES } from './hero-scenes';

// Each hero scene's window shows the editor mode its "build yours" link opens, and a scene that
// searches for a template shows the mode that template opens in (a town hall opens in Workshop,
// docs/specs/012-collaboration/workshop-mode.md), so the mock never wears a mode the editor
// would not show.
describe('hero scenes', () => {
  it.each(HERO_SCENES.map((s) => [s.key, s] as const))(
    '%s links to the mode its window shows',
    (_, scene) => {
      const url = new URL(scene.build, 'https://livediagram.app');
      expect(url.pathname).toBe('/new');
      expect(url.searchParams.get('mode')).toBe(scene.mode);
    },
  );

  it.each(
    HERO_SCENES.filter((s) =>
      new URL(s.build, 'https://livediagram.app').searchParams.has('q'),
    ).map((s) => [s.key, s] as const),
  )('%s searches for a template that opens in its mode', (_, scene) => {
    const q = new URL(scene.build, 'https://livediagram.app').searchParams.get('q')!.toLowerCase();
    const match = TEMPLATES.filter(
      (t) =>
        !t.hidden && t.title.toLowerCase().includes(q) && templateEditorMode(t.kind) === scene.mode,
    );
    expect(match.length, `a "${q}" template in ${scene.mode}`).toBeGreaterThan(0);
  });
});
