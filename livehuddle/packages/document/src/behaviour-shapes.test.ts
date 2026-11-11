import { describe, expect, it } from 'vitest';
import { BEHAVIOUR_SHAPES, carriesSharedSettingsMenu, isBehaviourShape } from './behaviour-shapes';

describe('behaviour shapes', () => {
  it('claims every kind in its own list', () => {
    for (const kind of BEHAVIOUR_SHAPES) expect(isBehaviourShape(kind)).toBe(true);
  });

  it('leaves ordinary shapes alone', () => {
    expect(isBehaviourShape('icon')).toBe(false);
    expect(isBehaviourShape('sticker')).toBe(false);
  });

  it('gives the shared menu to a kind with settings behind it', () => {
    expect(carriesSharedSettingsMenu('mode-button')).toBe(true);
    expect(carriesSharedSettingsMenu('chair')).toBe(false);
  });

  it('gives Bring Focus no menu at all', () => {
    // Nothing on it is set from a menu of its own: its colours and label are
    // reached by right-clicking the element, like every other shape.
    expect(carriesSharedSettingsMenu('focus-button')).toBe(false);
  });

  it('gives nothing to a shape outside the family', () => {
    expect(carriesSharedSettingsMenu('icon')).toBe(false);
  });
});
