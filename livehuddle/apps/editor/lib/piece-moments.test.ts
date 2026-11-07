// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createMomentTrigger,
  hasMoment,
  inMomentReach,
  MOMENT_GAP_MS,
  MOMENT_KINDS,
  MOMENT_PIECE_REST_MS,
  MOMENT_REACH,
  playMoment,
  resetPieceMoments,
  swaysOnMoment,
  usePieceMoment,
  type MomentPiece,
} from './piece-moments';

// docs/specs/009-elements/piece-moments.md "When one plays".
const tree: MomentPiece = { id: 't', kind: 'tree', x: 100, y: 100, width: 120, height: 160 };
const pond: MomentPiece = { id: 'p', kind: 'pond', x: 500, y: 100, width: 240, height: 152 };
const away = { x: 0, y: 0 };
const atTree = { x: 90, y: 250 };
const atPond = { x: 600, y: 90 };

// A trigger on a clock the test moves, with rolls it hands out in turn.
function setup(rolls: number[] = [0]) {
  let t = 1_000_000;
  let i = 0;
  const trigger = createMomentTrigger({ now: () => t, random: () => rolls[i++ % rolls.length]! });
  return {
    trigger,
    tick: (ms: number) => {
      t += ms;
    },
    // Walk away, then back up to the piece: one arrival.
    arrive: (at = atTree, pieces = [tree]) => {
      trigger.step(away, pieces);
      return trigger.step(at, pieces);
    },
  };
}

describe('which pieces have a moment', () => {
  it('names the eight kinds, and the three whose drawing rocks', () => {
    expect(MOMENT_KINDS).toHaveLength(8);
    for (const k of MOMENT_KINDS) expect(hasMoment(k)).toBe(true);
    expect(hasMoment('chair')).toBe(false);
    expect(['tree', 'outdoor-plant', 'plant'].every(swaysOnMoment)).toBe(true);
    expect(swaysOnMoment('pond')).toBe(false);
  });
});

describe('the reach', () => {
  it('is the base of what stands up, 24 px round it, never its top', () => {
    expect(inMomentReach({ x: 100 - MOMENT_REACH, y: 260 + MOMENT_REACH }, tree)).toBe(true);
    expect(inMomentReach({ x: 160, y: 100 + 160 * 0.6 }, tree)).toBe(true);
    // Up by the canopy.
    expect(inMomentReach({ x: 160, y: 150 }, tree)).toBe(false);
    expect(inMomentReach({ x: 100 - MOMENT_REACH - 1, y: 250 }, tree)).toBe(false);
    expect(inMomentReach({ x: 160, y: 260 + MOMENT_REACH + 1 }, tree)).toBe(false);
  });

  it('is all round what lies flat, above it too', () => {
    expect(inMomentReach({ x: 600, y: 100 - MOMENT_REACH }, pond)).toBe(true);
    expect(inMomentReach({ x: 600, y: 100 - MOMENT_REACH - 1 }, pond)).toBe(false);
  });
});

describe('the trigger', () => {
  it('plays on arriving, from your side, and never again while you stand there', () => {
    const { trigger } = setup();
    expect(trigger.step(away, [tree])).toBeNull();
    expect(trigger.step(atTree, [tree])).toEqual({ id: 't', side: -1 });
    expect(trigger.step({ x: 95, y: 255 }, [tree])).toBeNull();
  });

  it('says the right side when you come from the right', () => {
    const { trigger } = setup();
    expect(trigger.step({ x: 230, y: 250 }, [tree])).toEqual({ id: 't', side: 1 });
  });

  it('plays one arrival in two, and always the third after two refusals', () => {
    const { arrive, tick } = setup([0.9]);
    expect(arrive()).toBeNull();
    tick(MOMENT_PIECE_REST_MS);
    expect(arrive()).toBeNull();
    tick(MOMENT_PIECE_REST_MS);
    expect(arrive()).toEqual({ id: 't', side: -1 });
    // The count starts again after a play.
    tick(MOMENT_PIECE_REST_MS);
    expect(arrive()).toBeNull();
  });

  it('asks one piece at most once in its rest, whatever the answer', () => {
    const { arrive, tick } = setup([0.9, 0]);
    expect(arrive()).toBeNull();
    tick(MOMENT_PIECE_REST_MS - 1);
    // Inside the rest: not asked, so the 0 roll is still to come.
    expect(arrive()).toBeNull();
    tick(1);
    expect(arrive()).toEqual({ id: 't', side: -1 });
  });

  it('plays nothing within the gap after the last moment, anywhere', () => {
    const { trigger, arrive, tick } = setup();
    expect(arrive()).not.toBeNull();
    tick(MOMENT_GAP_MS - 1);
    expect(arrive(atPond, [tree, pond])).toBeNull();
    trigger.step(away, [tree, pond]);
    tick(1);
    expect(trigger.step(atPond, [tree, pond])).toEqual({ id: 'p', side: -1 });
  });

  it('asks only the first arrival of a step', () => {
    const near = { ...tree, id: 'n', x: 150 };
    const { trigger } = setup();
    const both = { x: 140, y: 250 };
    expect(trigger.step(both, [tree, near])?.id).toBe('t');
    expect(trigger.step(both, [tree, near])).toBeNull();
  });

  it('takes walking back in after a reset as an arrival', () => {
    const { trigger, tick } = setup();
    expect(trigger.step(atTree, [tree])).not.toBeNull();
    tick(MOMENT_PIECE_REST_MS);
    expect(trigger.step(atTree, [tree])).toBeNull();
    trigger.reset();
    expect(trigger.step(atTree, [tree])).not.toBeNull();
  });

  it('uses the real clock and dice by default', () => {
    const trigger = createMomentTrigger();
    const seen = Array.from({ length: 3 }, (_, i) => {
      const piece = { ...tree, id: `t${i}` };
      return trigger.step(atTree, [piece]);
    });
    // The first arrival plays or refuses; the gap holds anything after a play.
    expect(seen.filter(Boolean).length).toBeLessThanOrEqual(1);
  });
});

describe('the store', () => {
  afterEach(resetPieceMoments);

  it('gives a piece its latest moment, counting up, and changes no other piece', () => {
    const { result } = renderHook(() => [usePieceMoment('a'), usePieceMoment('b')]);
    expect(result.current).toEqual([null, null]);
    act(() => playMoment('a', 1));
    expect(result.current).toEqual([{ seq: 1, side: 1 }, null]);
    act(() => playMoment('a', -1));
    expect(result.current[0]).toEqual({ seq: 2, side: -1 });
  });
});
