import { describe, expect, it } from 'vitest';
import { heroBackdropOf } from './hero/HeroBackdrop';
import { appOfKind, OPENS_IN_VALUES } from './lens/dimensions';
import { heroWords, kindWords, siteOf } from './words';

// livehuddle, registered before its launch (liveworkspace/docs/specs/002-architecture/integrating-an-app.md): the
// Explorer can name its items, and offers it in no list.
describe('a held app (livehuddle) in the Explorer', () => {
  it('is no Opens in choice until it launches', () => {
    expect(OPENS_IN_VALUES).toEqual(['canvas', 'plan', 'document', 'design']);
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
