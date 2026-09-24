import { describe, expect, it } from 'vitest';
import { DEFAULT_ICON_ANIMATION, ICON_ANIMATIONS, defaultIconAnimation } from './animation';

// The catalogue carries four glyphs drawn to MOVE (spec/09): a spinner whose
// arc has a gap so the rotation reads, a gear, a heart, a broadcast signal.
// The per-element animation is opt-in for every other icon, which left these
// four sitting still unless you went and found the menu.
//
// An animation name that is not one of the real ones would render as no class
// at all, so the set is pinned here; that the ids match the palette's Animated
// category is pinned next to that category, in the editor.

describe('default icon animations', () => {
  it('names only real animations', () => {
    for (const anim of Object.values(DEFAULT_ICON_ANIMATION)) {
      expect(ICON_ANIMATIONS).toContain(anim);
    }
  });

  it('gives each animated glyph the motion it was drawn for', () => {
    expect(defaultIconAnimation('spinner')).toBe('spin');
    expect(defaultIconAnimation('gear')).toBe('spin');
    expect(defaultIconAnimation('heartbeat')).toBe('beat');
    expect(defaultIconAnimation('signal')).toBe('ping');
  });

  it('leaves every other icon static', () => {
    expect(defaultIconAnimation('rocket')).toBeUndefined();
    expect(defaultIconAnimation(undefined)).toBeUndefined();
  });
});
