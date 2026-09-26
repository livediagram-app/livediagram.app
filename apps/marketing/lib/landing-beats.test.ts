import { describe, expect, it } from 'vitest';
import { LANDING_BEATS, beatSections, beatShowcase } from './landing-beats';
import { LANDING_SECTION_IDS } from './landing-content';

describe('LANDING_BEATS', () => {
  // The landing page links to a category only through its beat, so a
  // category left out of every beat has no way in from home.
  it('places every feature category in exactly one beat', () => {
    const placed = LANDING_BEATS.flatMap((beat) => beat.sections.map((s) => s.id));
    expect([...placed].sort()).toEqual([...LANDING_SECTION_IDS].sort());
  });

  it('tells the story in five beats with unique anchors', () => {
    expect(LANDING_BEATS).toHaveLength(5);
    const ids = LANDING_BEATS.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('resolves every beat’s sections and showcase picks', () => {
    for (const beat of LANDING_BEATS) {
      expect(beatSections(beat)).toHaveLength(beat.sections.length);
      const scenes = beatShowcase(beat);
      expect(scenes).toHaveLength(3);
      // A showcase scene with no art would render as a bare caption.
      for (const scene of scenes) expect(scene.art).toBeTruthy();
    }
  });

  it('never uses an em dash in its copy', () => {
    for (const beat of LANDING_BEATS) {
      for (const text of [beat.title, beat.description, beat.cta]) {
        expect(text).not.toContain('—');
      }
    }
  });
});
