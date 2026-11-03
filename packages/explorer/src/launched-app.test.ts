import { describe, expect, it } from 'vitest';
import { heroBackdropOf } from './hero/HeroBackdrop';
import { appOfKind, OPENS_IN_VALUES } from './lens/dimensions';
import { heroWords, kindWords, siteOf } from './words';

// livehuddle, launched (livehuddle/docs/specs/005-project-roadmap/build-plan.md step 8): the Explorer names its items
// and offers it in its lists, as any app.
describe('a launched app (livehuddle) in the Explorer', () => {
  it('is an Opens in choice', () => {
    expect(OPENS_IN_VALUES).toEqual(['canvas', 'plan', 'document', 'design', 'space']);
    expect(appOfKind('space')).toBe('livehuddle');
  });

  it('calls its item a Space, on its own site', () => {
    expect(kindWords('livehuddle')).toEqual({
      one: 'Space',
      many: 'Spaces',
      lowerOne: 'space',
      lowerMany: 'spaces',
    });
    expect(heroWords('livehuddle').question).toBe('who are you meeting today?');
    expect(siteOf('livehuddle')).toMatchObject({ id: 'livehuddle.app', accent: '#10b981' });
    expect(heroBackdropOf('livehuddle', 'app')).toBe('dots');
  });
});
