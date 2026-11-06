import { describe, expect, it } from 'vitest';
import {
  admitBubble,
  bubbleEndsAt,
  bubbleMotion,
  edgeShift,
  screenX,
  screenY,
  topShift,
  SPEECH_TOP_CLEAR,
  flightMs,
  headPoint,
  nextDraft,
  liveBubbles,
  SeenIds,
  tailOffset,
  speechLift,
  SPEECH_CLEAR_GAP,
  SPEECH_FADE_FRACTION,
  SPEECH_MAX_MS,
  SPEECH_OVERFLOW_FADE_MS,
  SPEECH_POP_MS,
  SPEECH_RISE_PX_PER_S,
  SPEECH_SWAY_PERIOD_MS,
  SPEECH_SWAY_PX,
  type SpeechBubble,
} from './speech';

const words = (n: number) => Array.from({ length: n }, () => 'w').join(' ');
const bubble = (over: Partial<SpeechBubble> = {}): SpeechBubble => ({
  id: 'b',
  from: 'p1',
  own: false,
  text: 'hi',
  tabId: 't',
  x: 0,
  y: 0,
  bornAt: 0,
  flightMs: 4000,
  ...over,
});

describe('flightMs (docs/specs/008-canvas/avatar-mode.md "Sending: the bubble floats away")', () => {
  it('is 7 s for up to two words', () => {
    expect(flightMs('hi')).toBe(7000);
    expect(flightMs('hi there')).toBe(7000);
  });
  it('adds 0.25 s for each further word', () => {
    expect(flightMs(words(3))).toBe(7250);
    expect(flightMs(words(12))).toBe(9500);
  });
  it('never passes 16 s, reached at 38 words', () => {
    expect(SPEECH_MAX_MS).toBe(16_000);
    expect(flightMs(words(37))).toBeLessThan(SPEECH_MAX_MS);
    expect(flightMs(words(38))).toBe(SPEECH_MAX_MS);
    expect(flightMs(words(50))).toBe(SPEECH_MAX_MS);
  });
});

describe('bubbleMotion', () => {
  it('rises at a steady pace', () => {
    expect(bubbleMotion(1000, 6000, false).rise).toBeCloseTo(SPEECH_RISE_PX_PER_S);
    expect(bubbleMotion(3000, 6000, false).rise).toBeCloseTo(3 * SPEECH_RISE_PX_PER_S);
  });
  it('sways within its width', () => {
    expect(bubbleMotion(SPEECH_SWAY_PERIOD_MS / 4, 6000, false).sway).toBeCloseTo(SPEECH_SWAY_PX);
    for (let t = 0; t < 6000; t += 97) {
      expect(Math.abs(bubbleMotion(t, 6000, false).sway)).toBeLessThanOrEqual(SPEECH_SWAY_PX);
    }
  });
  it('holds full opacity, then fades over the last third', () => {
    const flight = 6000;
    expect(bubbleMotion(flight * (1 - SPEECH_FADE_FRACTION), flight, false).opacity).toBe(1);
    expect(bubbleMotion(5000, flight, false).opacity).toBeCloseTo(0.5);
    expect(bubbleMotion(flight, flight, false).opacity).toBe(0);
  });
  it('pops in, overshooting a little, then settles at full size', () => {
    expect(bubbleMotion(0, 6000, false).scale).toBeCloseTo(0.6);
    const peak = Math.max(...[60, 100, 140, 180].map((t) => bubbleMotion(t, 6000, false).scale));
    expect(peak).toBeGreaterThan(1);
    expect(bubbleMotion(SPEECH_POP_MS, 6000, false).scale).toBeCloseTo(1);
  });
  it('lets go of the head: the tail fades', () => {
    expect(bubbleMotion(0, 6000, false).tail).toBe(1);
    expect(bubbleMotion(1000, 6000, false).tail).toBe(0);
  });
  it('under reduced motion, neither pops, sways nor rises, but still fades', () => {
    const m = bubbleMotion(5000, 6000, true);
    expect([m.rise, m.sway, m.scale]).toEqual([0, 0, 1]);
    expect(m.opacity).toBeCloseTo(0.5);
  });
  it('a hurried bubble fades out fast', () => {
    expect(bubbleMotion(500, 6000, false, SPEECH_OVERFLOW_FADE_MS / 2).opacity).toBeCloseTo(0.5);
    expect(bubbleMotion(500, 6000, false, SPEECH_OVERFLOW_FADE_MS).opacity).toBe(0);
  });
});

describe('admitBubble (three per person on screen)', () => {
  it('adds freely up to three of one person', () => {
    let list: SpeechBubble[] = [];
    for (const id of ['a', 'b', 'c']) list = admitBubble(list, bubble({ id }), 0);
    expect(list.every((b) => b.leavingAt === undefined)).toBe(true);
  });
  it('a fourth hurries that person’s oldest off, and nobody else’s', () => {
    let list: SpeechBubble[] = [bubble({ id: 'other', from: 'p2' })];
    for (const id of ['a', 'b', 'c']) list = admitBubble(list, bubble({ id }), 0);
    list = admitBubble(list, bubble({ id: 'd' }), 1000);
    expect(list.find((b) => b.id === 'a')?.leavingAt).toBe(1000);
    expect(list.find((b) => b.id === 'other')?.leavingAt).toBeUndefined();
    expect(bubbleEndsAt(list.find((b) => b.id === 'a')!)).toBe(1000 + SPEECH_OVERFLOW_FADE_MS);
  });
  it('drops bubbles whose flight is over', () => {
    const list = [bubble({ id: 'a', flightMs: 4000 }), bubble({ id: 'b', bornAt: 3000 })];
    expect(liveBubbles(list, 4500).map((b) => b.id)).toEqual(['b']);
  });
});

describe('headPoint', () => {
  it('sits above the head, scaled with the character', () => {
    expect(headPoint({ x: 10, y: 100 }, 1)).toEqual({ x: 10, y: 36 });
    expect(headPoint({ x: 10, y: 100 }, 1.5)).toEqual({ x: 10, y: 4 });
  });
});

// docs/specs/012-collaboration/video-and-screen-bubbles.md "Close together": speech bubbles stay clear.
describe('speechLift', () => {
  const box = (left: number, top: number, w = 120, h = 68) => ({
    left,
    top,
    right: left + w,
    bottom: top + h,
  });
  const from = { x: 100, y: 300 };

  it('stays at the head with nothing in the way', () => {
    expect(speechLift(from, 60, 200, [])).toBe(0);
    // Beside its path, below where it starts, and beyond its reach.
    expect(speechLift(from, 60, 200, [box(170, 200), box(40, 310), box(40, -100)])).toBe(0);
  });

  it('starts over a bubble on its way up, its own speaker’s or a neighbour’s', () => {
    expect(speechLift(from, 60, 200, [box(40, 182)])).toBe(300 - 182 + SPEECH_CLEAR_GAP);
    // One straddling the head lifts it too.
    expect(speechLift(from, 60, 200, [box(140, 280)])).toBe(20 + SPEECH_CLEAR_GAP);
  });

  it('climbs past a stack, each lift bringing the next into reach', () => {
    // The second is out of reach from the head but in reach once lifted over the first.
    const lift = speechLift(from, 60, 100, [box(0, -300), box(40, 182), box(60, 40)]);
    expect(lift).toBe(300 - 40 + SPEECH_CLEAR_GAP);
  });
});

describe('SeenIds', () => {
  it('answers whether an id is new, forgetting the oldest past its cap', () => {
    const seen = new SeenIds(2);
    expect(seen.add('a')).toBe(true);
    expect(seen.add('a')).toBe(false);
    seen.add('b');
    seen.add('c');
    expect(seen.add('a')).toBe(true);
  });
});

describe('nextDraft (typing past the limit is refused, a paste is clamped)', () => {
  const fifty = words(50);
  it('takes an edit within the limits, newlines as spaces', () => {
    expect(nextDraft('', 'hi\nthere', false)).toBe('hi there');
  });
  it('refuses a keystroke past fifty words', () => {
    expect(nextDraft(fifty, `${fifty} more`, false)).toBe(fifty);
  });
  it('clamps a paste past the limits', () => {
    expect(nextDraft('', words(80), true)).toBe(fifty);
  });
});

describe('topShift (a bubble stays below the top chrome, Work Tracker #394)', () => {
  it('leaves a card whose top is clear of the top chrome', () => {
    expect(topShift(SPEECH_TOP_CLEAR)).toBe(0);
    expect(topShift(300)).toBe(0);
  });
  it('drops a card rising into the top chrome back below it', () => {
    expect(topShift(100)).toBe(20);
    expect(topShift(-30)).toBe(150);
  });
  it('reads a canvas y on screen as screenX reads an x', () => {
    expect(screenY(100, 2, 7.5, 390)).toBe(screenX(100, 2, 7.5, 390));
  });
});

describe('edgeShift (a bubble stays whole inside the view)', () => {
  it('leaves a bubble that fits where it is', () => {
    expect(edgeShift(200, 100, 390)).toBe(0);
    expect(edgeShift(58, 100, 390)).toBe(0);
  });
  it('pulls a bubble over the left edge back in, to the margin', () => {
    expect(edgeShift(20, 100, 390)).toBe(38);
    expect(edgeShift(-50, 100, 390)).toBe(108);
  });
  it('pulls a bubble over the right edge back in, to the margin', () => {
    expect(edgeShift(380, 100, 390)).toBe(-48);
  });
  it('keeps the left edge of a card wider than the view in view', () => {
    expect(edgeShift(100, 500, 390)).toBe(158);
  });
});

describe('tailOffset (the tail stays on the head the card was shifted off)', () => {
  it('points back the way the card was shifted', () => {
    expect(tailOffset(38, 100)).toBe(-36);
    expect(tailOffset(-48, 100)).toBe(36);
    expect(tailOffset(0, 100)).toBeCloseTo(0);
  });
  it('never rides onto a corner, nor leaves a narrow card', () => {
    expect(tailOffset(500, 100)).toBe(-36);
    expect(tailOffset(-500, 100)).toBe(36);
    expect(tailOffset(20, 20)).toBe(0);
  });
});

describe('screenX (the canvas layer scales about its centre)', () => {
  it('is the offset point at zoom 1', () => {
    expect(screenX(100, 1, 20, 390)).toBe(120);
  });
  it('keeps the centre still while zooming', () => {
    expect(screenX(195, 0.6, 0, 390)).toBeCloseTo(195);
  });
  it('scales the pan and the distance from the centre', () => {
    expect(screenX(0, 0.5, -400, 800)).toBe(0);
    expect(screenX(100, 2, 7.5, 390)).toBe(20);
  });
});
