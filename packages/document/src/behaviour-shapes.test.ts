import { describe, expect, it } from 'vitest';
import {
  BEHAVIOUR_SHAPES,
  carriesSharedSettingsMenu,
  drawsOwnElementMenu,
  isBehaviourShape,
} from './behaviour-shapes';

describe('behaviour shapes', () => {
  it('claims every kind in its own list', () => {
    for (const kind of BEHAVIOUR_SHAPES) expect(isBehaviourShape(kind)).toBe(true);
  });

  it('leaves ordinary shapes alone', () => {
    expect(isBehaviourShape('square')).toBe(false);
  });

  it('never gives a kind both menus', () => {
    // Two ellipses in the same corner of the same card is a bug you can see
    // from across the room.
    for (const kind of BEHAVIOUR_SHAPES) {
      expect(drawsOwnElementMenu(kind) && carriesSharedSettingsMenu(kind)).toBe(false);
    }
  });

  it('gives the shared menu to a kind with settings behind it', () => {
    expect(carriesSharedSettingsMenu('picker')).toBe(true);
    expect(carriesSharedSettingsMenu('comment-pin')).toBe(false);
  });

  it('gives the session button its own menu', () => {
    expect(drawsOwnElementMenu('session-button')).toBe(true);
    expect(carriesSharedSettingsMenu('session-button')).toBe(false);
  });

  it('gives nothing to a shape outside the family', () => {
    expect(carriesSharedSettingsMenu('square')).toBe(false);
  });
});
