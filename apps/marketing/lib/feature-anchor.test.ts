import { describe, expect, it } from 'vitest';
import { LANDING_SECTIONS } from './landing-content';
import { featureAnchor, featureHref } from './feature-anchor';

describe('featureAnchor (spec/16)', () => {
  it('kebab-cases a title, dropping punctuation', () => {
    expect(featureAnchor('Run the session: timer + voting')).toBe('run-the-session-timer-voting');
    expect(featureAnchor('Your screen, not everyone else’s')).toBe(
      'your-screen-not-everyone-else-s',
    );
  });

  it('builds the badge link', () => {
    expect(featureHref('collaboration', 'Live presence')).toBe(
      '/features/collaboration#live-presence',
    );
  });

  it('is unique within every section, so each badge lands on its own card', () => {
    for (const section of LANDING_SECTIONS) {
      const anchors = section.items.map((i) => featureAnchor(i.title));
      expect(new Set(anchors).size, section.id).toBe(anchors.length);
      for (const a of anchors) expect(a, section.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });
});
