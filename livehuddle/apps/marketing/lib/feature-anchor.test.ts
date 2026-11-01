import { describe, expect, it } from 'vitest';
import { LANDING_SECTIONS } from './landing-content';
import { featureAnchor } from '@liveworkspace/marketing-site/lib/feature-anchor';

// How an anchor is made is tested with it in @liveworkspace/marketing-site; this holds this app's sections to it.
describe('featureAnchor (docs/specs/019-marketing/marketing-site.md)', () => {
  it('is unique within every section, so each badge lands on its own card', () => {
    for (const section of LANDING_SECTIONS) {
      const anchors = section.items.map((i) => featureAnchor(i.title));
      expect(new Set(anchors).size, section.id).toBe(anchors.length);
      for (const a of anchors) expect(a, section.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });
});
