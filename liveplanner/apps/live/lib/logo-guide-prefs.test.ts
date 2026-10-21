import { describe, expect, it } from 'vitest';
import { readLogoGuideParts, readLogoGuideStrength, withLogoGuidePart } from './logo-guide-prefs';

// docs/specs/007-editor/logo-pages.md "Construction guides": which guides show, and how strongly.
describe('logo guide preferences', () => {
  it('shows every part at Medium by default', () => {
    expect(readLogoGuideParts({}).size).toBe(6);
    expect(readLogoGuideStrength({})).toBe('medium');
    expect(readLogoGuideStrength({ logoGuideStrength: 'strong' })).toBe('strong');
  });

  it('hides and shows a part, storing none hidden as absent', () => {
    const hidden = withLogoGuidePart({}, 'grid', false);
    expect(hidden.logoGuidesHidden).toEqual(['grid']);
    expect(readLogoGuideParts(hidden).has('grid')).toBe(false);
    expect(withLogoGuidePart(hidden, 'grid', true)).toEqual({});
  });

  it('ignores stale parts it no longer knows', () => {
    expect(readLogoGuideParts({ logoGuidesHidden: ['nope', 'safe'] }).size).toBe(5);
  });
});
