// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  COUNTER_REACH,
  createMomentTrigger,
  hasMoment,
  inMomentReach,
  MOMENT_KINDS,
  MOMENT_MS,
  MOMENT_REACH,
  MOMENT_TOP,
  momentPiece,
  playMoment,
  resetPieceMoments,
  swaysOnMoment,
  usePieceMoment,
  WALL_REACH,
  type MomentPiece,
} from './piece-moments';

// docs/specs/009-elements/piece-moments.md "When one plays".
const tree: MomentPiece = momentPiece({
  id: 't',
  kind: 'tree',
  x: 100,
  y: 100,
  width: 120,
  height: 160,
});
const pond: MomentPiece = momentPiece({
  id: 'p',
  kind: 'pond',
  x: 500,
  y: 100,
  width: 240,
  height: 152,
});
const away = { x: 0, y: 0 };
const atTree = { x: 90, y: 250 };

// A trigger on a clock the test moves.
function setup() {
  let t = 1_000_000;
  const trigger = createMomentTrigger({ now: () => t });
  return {
    trigger,
    tick: (ms: number) => {
      t += ms;
    },
    // Walk away, then back up to the piece: one arrival, and what it played (copied: the array is reused).
    arrive: (at = atTree, pieces = [tree]) => {
      trigger.step(away, pieces);
      return [...trigger.step(at, pieces)];
    },
  };
}

describe('which pieces have a moment', () => {
  it('names every static piece, and the three that play at every facing', () => {
    // 35 static pieces and the six interactive ones with a walk-up answer (Work Tracker 626).
    expect(MOMENT_KINDS).toHaveLength(41);
    for (const k of [
      'hammock',
      'notice-board',
      'world-clock',
      'calendar-wall',
      'suggestion-box',
      'window',
    ])
      expect(hasMoment(k)).toBe(true);
    for (const k of MOMENT_KINDS) expect(hasMoment(k)).toBe(true);
    // Interactive and structural pieces have none (piece-moments.md "Which pieces have a moment").
    for (const k of [
      'chair',
      'water-cooler',
      'arcade-machine',
      'reception-desk',
      'room',
      'rug',
      'door',
    ])
      expect(hasMoment(k)).toBe(false);
    expect(['tree', 'outdoor-plant', 'plant'].every(swaysOnMoment)).toBe(true);
    expect(swaysOnMoment('pond')).toBe(false);
  });

  it('plays every kind for under three seconds, and starts its reach inside its box', () => {
    for (const k of MOMENT_KINDS) {
      expect(MOMENT_MS[k]).toBeGreaterThan(0);
      expect(MOMENT_MS[k]).toBeLessThan(3000);
      expect(MOMENT_TOP[k]).toBeGreaterThanOrEqual(0);
      expect(MOMENT_TOP[k]).toBeLessThan(1);
    }
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

  it('reaches the floor in front of a wall piece and in front of the counter under a kettle', () => {
    const board = momentPiece({ id: 'd', kind: 'dartboard', x: 0, y: 0, width: 80, height: 96 });
    expect(inMomentReach({ x: 40, y: 96 + WALL_REACH }, board)).toBe(true);
    expect(inMomentReach({ x: 40, y: 96 + WALL_REACH + 1 }, board)).toBe(false);
    const kettle = momentPiece({ id: 'k', kind: 'kettle', x: 0, y: 0, width: 32, height: 36 });
    expect(inMomentReach({ x: 16, y: 36 + COUNTER_REACH }, kettle)).toBe(true);
    expect(inMomentReach({ x: 16, y: 36 + COUNTER_REACH + 1 }, kettle)).toBe(false);
    // The walk-up pieces that hang on a wall reach its floor too.
    for (const kind of ['notice-board', 'world-clock', 'calendar-wall'] as const) {
      const hung = momentPiece({ id: kind, kind, x: 0, y: 0, width: 176, height: 128 });
      expect(inMomentReach({ x: 88, y: 128 + WALL_REACH }, hung)).toBe(true);
      expect(inMomentReach({ x: 88, y: 128 + WALL_REACH + 1 }, hung)).toBe(false);
    }
  });

  // A 120 x 24 window whose middle is (200, 100), its light on its own +y (room-builder.md "Window").
  const pane = (rotation?: number) =>
    momentPiece({ id: 'w', kind: 'window', x: 140, y: 88, width: 120, height: 24, rotation });

  it("is the floor a window's light falls on, past each end, never the far side of its wall", () => {
    const w = pane();
    expect(inMomentReach({ x: 200, y: 100 + 12 + WALL_REACH }, w)).toBe(true);
    expect(inMomentReach({ x: 200, y: 100 + 12 + WALL_REACH + 1 }, w)).toBe(false);
    expect(inMomentReach({ x: 140 - MOMENT_REACH, y: 130 }, w)).toBe(true);
    expect(inMomentReach({ x: 140 - MOMENT_REACH - 1, y: 130 }, w)).toBe(false);
    // Outside the room, behind the wall.
    expect(inMomentReach({ x: 200, y: 99 }, w)).toBe(false);
  });

  it("turns a window's reach with it onto its wall", () => {
    // A quarter turn clockwise: the wall runs down the canvas and the light falls to the left.
    const w = pane(90);
    expect(inMomentReach({ x: 200 - 12 - WALL_REACH, y: 100 }, w)).toBe(true);
    expect(inMomentReach({ x: 200 + 1, y: 100 }, w)).toBe(false);
    expect(inMomentReach({ x: 170, y: 100 + 60 + MOMENT_REACH }, w)).toBe(true);
    expect(inMomentReach({ x: 170, y: 100 + 60 + MOMENT_REACH + 1 }, w)).toBe(false);
    // Turned right over: the light falls up the canvas.
    const flipped = pane(180);
    expect(inMomentReach({ x: 200, y: 60 }, flipped)).toBe(true);
    expect(inMomentReach({ x: 200, y: 130 }, flipped)).toBe(false);
  });
});

describe('the trigger', () => {
  it('plays on arriving, from your side, and never again while you stand there', () => {
    const { trigger } = setup();
    expect(trigger.step(away, [tree])).toEqual([]);
    expect(trigger.step(atTree, [tree])).toEqual([{ id: 't', side: -1 }]);
    expect(trigger.step({ x: 95, y: 255 }, [tree])).toEqual([]);
  });

  it('says the right side when you come from the right', () => {
    const { trigger } = setup();
    expect(trigger.step({ x: 230, y: 250 }, [tree])).toEqual([{ id: 't', side: 1 }]);
  });

  it("says your side along a window's wall, whichever way it is turned", () => {
    const w = momentPiece({
      id: 'w',
      kind: 'window',
      x: 140,
      y: 88,
      width: 120,
      height: 24,
      rotation: 90,
    });
    // Turned a quarter clockwise, its own +x runs down the canvas: above its middle is its left end.
    expect(createMomentTrigger().step({ x: 170, y: 70 }, [w])).toEqual([{ id: 'w', side: -1 }]);
    expect(createMomentTrigger().step({ x: 170, y: 130 }, [w])).toEqual([{ id: 'w', side: 1 }]);
  });

  it('plays every arrival, every time (owner 2026-11-07)', () => {
    const { arrive, tick } = setup();
    for (let i = 0; i < 6; i++) {
      expect(arrive()).toEqual([{ id: 't', side: -1 }]);
      tick(MOMENT_MS.tree);
    }
  });

  it('never restarts a moment while it is still playing, and plays the arrival after it ends', () => {
    const { arrive, tick } = setup();
    expect(arrive()).toHaveLength(1);
    tick(MOMENT_MS.tree - 1);
    // Out and back in mid-moment: nothing restarts.
    expect(arrive()).toEqual([]);
    tick(1);
    expect(arrive()).toEqual([{ id: 't', side: -1 }]);
  });

  it('plays another piece straight away while one is still playing', () => {
    const { trigger, arrive } = setup();
    expect(arrive()).toHaveLength(1);
    trigger.step(away, [tree, pond]);
    expect(trigger.step({ x: 600, y: 90 }, [tree, pond])).toEqual([{ id: 'p', side: -1 }]);
  });

  it('plays both pieces you reach on one step', () => {
    const near = momentPiece({ ...tree, id: 'n', x: 150 });
    const { trigger } = setup();
    const both = { x: 140, y: 250 };
    expect(trigger.step(both, [tree, near])).toEqual([
      { id: 't', side: -1 },
      { id: 'n', side: -1 },
    ]);
    expect(trigger.step(both, [tree, near])).toEqual([]);
  });

  it('takes walking back in after a reset as an arrival, but keeps a moment from restarting', () => {
    const { trigger, tick } = setup();
    expect(trigger.step(atTree, [tree])).toHaveLength(1);
    trigger.reset();
    // Still playing: the reset does not restart it.
    expect(trigger.step(atTree, [tree])).toEqual([]);
    tick(MOMENT_MS.tree);
    // Standing there since: no new arrival until a reset.
    expect(trigger.step(atTree, [tree])).toEqual([]);
    trigger.reset();
    expect(trigger.step(atTree, [tree])).toHaveLength(1);
  });

  it('uses the real clock by default', () => {
    const trigger = createMomentTrigger();
    const pieces = [0, 1, 2].map((i) => ({ ...tree, id: `t${i}` }));
    expect(trigger.step(atTree, pieces)).toHaveLength(3);
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
