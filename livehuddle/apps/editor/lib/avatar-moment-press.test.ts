// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DOOR_REACH, type Element } from '@livehuddle/document';
import { avatarMomentPress, replayMoment, replaysOnPress } from './avatar-moment-press';
import { MOMENT_KINDS, MOMENT_MS, momentPlaying, resetPieceMoments } from './piece-moments';

const motion = vi.hoisted(() => ({ reduced: false }));
vi.mock('@liveworkspace/workbench/lib/motion-preference', () => ({
  prefersReducedMotion: () => motion.reduced,
}));

// docs/specs/009-elements/piece-moments.md "A press beside it".
const piece = (shape: string, extra: Partial<Element> = {}) =>
  ({ id: 'p', type: 'shape', shape, x: 100, y: 100, width: 120, height: 80, ...extra }) as Element;

afterEach(() => {
  resetPieceMoments();
  motion.reduced = false;
});

describe('which pieces replay on a press', () => {
  it('takes the moment pieces a click walks to, and never a seat or a piece a click uses', () => {
    const replays = MOMENT_KINDS.filter(replaysOnPress);
    // 35 static pieces less the Podium (a seat you stand at), plus the Window.
    expect(replays).toHaveLength(35);
    expect(replays).toContain('window');
    for (const k of [
      'hammock',
      'podium',
      'notice-board',
      'world-clock',
      'calendar-wall',
      'suggestion-box',
    ])
      expect(replaysOnPress(k)).toBe(false);
    // Not a moment piece at all.
    for (const k of ['chair', 'room', 'water-cooler']) expect(replaysOnPress(k)).toBe(false);
  });
});

describe('avatarMomentPress', () => {
  it('answers a press on a piece your feet stand beside, from your side', () => {
    expect(avatarMomentPress(piece('tree'), { x: 90, y: 150 })).toEqual({
      id: 'p',
      kind: 'tree',
      side: -1,
    });
    expect(avatarMomentPress(piece('tree'), { x: 230, y: 150 })?.side).toBe(1);
  });

  it('takes the Door reach round the box as beside, and no farther', () => {
    // Above a tree, outside its moment reach (which starts part way down it).
    expect(avatarMomentPress(piece('tree'), { x: 160, y: 100 - DOOR_REACH })).not.toBeNull();
    expect(avatarMomentPress(piece('tree'), { x: 160, y: 100 - DOOR_REACH - 1 })).toBeNull();
  });

  it('takes a counter piece’s moment reach as beside, past the Door reach', () => {
    // A Kettle's reach runs well below it, to the floor in front of its counter.
    expect(avatarMomentPress(piece('kettle'), { x: 160, y: 180 + DOOR_REACH + 20 })).not.toBeNull();
  });

  it('walks for a seat, a non-moment piece, a missing hit or missing feet', () => {
    const feet = { x: 90, y: 150 };
    expect(avatarMomentPress(piece('hammock'), feet)).toBeNull();
    expect(avatarMomentPress(piece('chair'), feet)).toBeNull();
    expect(avatarMomentPress({ ...piece('tree'), type: 'sticky' } as Element, feet)).toBeNull();
    expect(avatarMomentPress(null, feet)).toBeNull();
    expect(avatarMomentPress(piece('tree'), null)).toBeNull();
  });
});

describe('replayMoment', () => {
  const press = { id: 'p', kind: 'tree' as const, side: 1 as const };

  it('plays the moment for its length, and never over itself', () => {
    replayMoment(press, 1000);
    expect(momentPlaying('p', 1000 + MOMENT_MS.tree - 1)).toBe(true);
    expect(momentPlaying('p', 1000 + MOMENT_MS.tree)).toBe(false);
    // A second press mid-moment changes nothing: it still ends when the first does.
    replayMoment(press, 1500);
    expect(momentPlaying('p', 1000 + MOMENT_MS.tree)).toBe(false);
    replayMoment(press, 1000 + MOMENT_MS.tree);
    expect(momentPlaying('p', 1000 + MOMENT_MS.tree)).toBe(true);
  });

  it('plays nothing under reduced motion', () => {
    motion.reduced = true;
    replayMoment(press, 1000);
    expect(momentPlaying('p', 1001)).toBe(false);
  });
});
