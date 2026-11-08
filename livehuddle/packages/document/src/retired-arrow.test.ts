import { describe, expect, it } from 'vitest';
import { cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import type { Element } from './index';
import { contentBounds } from './svg-render';
import {
  RETIRED_ARROW_CARD_HEIGHT,
  RETIRED_ARROW_CARD_WIDTH,
  RETIRED_ARROW_MAX_HOPS,
  isRetiredArrow,
  retiredArrowBounds,
  retiredArrowCard,
  retiredArrowEnds,
  type RetiredArrowElement,
  type RetiredEndpoint,
} from './retired-arrow';

// docs/specs/002-project-scope/blueprints/element-engine.md D21 and D22: a stored arrow's ends are worked out from
// what it stored each time; an end that does not resolve takes the other end's point, and with neither the line sits
// at the origin. The card is 160 by 96, centred on the line's middle.

const box = (id: string, x: number, y: number, extra: Record<string, unknown> = {}) => ({
  id,
  type: 'shape',
  shape: 'square',
  x,
  y,
  width: 100,
  height: 60,
  ...extra,
});

const arrow = (
  id: string,
  from: RetiredEndpoint,
  to: RetiredEndpoint,
  extra: Partial<RetiredArrowElement> = {},
): RetiredArrowElement => ({ id, type: 'arrow', from, to, ...extra });

const free = (x: number, y: number): RetiredEndpoint => ({ kind: 'free', x, y });
const pinned = (
  elementId: string,
  anchor: 'n' | 'e' | 's' | 'w' | 'ne' | 'nne',
): RetiredEndpoint => ({
  kind: 'pinned',
  elementId,
  anchor,
});
const onArrow = (arrowId: string, t: number): RetiredEndpoint => ({ kind: 'on-arrow', arrowId, t });

describe('isRetiredArrow', () => {
  it('is true for a stored arrow only', () => {
    expect(isRetiredArrow({ type: 'arrow' })).toBe(true);
    expect(isRetiredArrow({ type: 'shape' })).toBe(false);
    expect(isRetiredArrow({ type: 'freehand' })).toBe(false);
  });
});

describe('retiredArrowEnds', () => {
  it('reads free ends as stored', () => {
    expect(retiredArrowEnds(arrow('a', free(10, 20), free(-5, 40)), [])).toEqual({
      from: { x: 10, y: 20 },
      to: { x: -5, y: 40 },
    });
  });

  it('pins an end to its element’s anchor', () => {
    const els = [box('p', 0, 0), box('q', 300, 100)];
    expect(retiredArrowEnds(arrow('a', pinned('p', 'e'), pinned('q', 'nne')), els)).toEqual({
      from: { x: 100, y: 30 },
      to: { x: 375, y: 100 },
    });
  });

  it('turns a pinned anchor with its element’s rotation, about the box’s centre', () => {
    // A 100 by 60 box at the origin turned 90 degrees clockwise: its east anchor (100, 30) lands below the centre.
    const els = [box('p', 0, 0, { rotation: 90 })];
    const { from } = retiredArrowEnds(arrow('a', pinned('p', 'e'), free(0, 0)), els);
    expect(from.x).toBeCloseTo(50);
    expect(from.y).toBeCloseTo(80);
  });

  it('reads a list and an index alike', () => {
    const els = [box('p', 0, 0), box('q', 300, 100)];
    const a = arrow('a', pinned('p', 's'), pinned('q', 'n'));
    expect(retiredArrowEnds(a, new Map(els.map((el) => [el.id, el])))).toEqual(
      retiredArrowEnds(a, els),
    );
  });

  it('places an on-arrow end along the target’s resolved line, by its t', () => {
    const target = arrow('t', free(0, 0), free(200, 100));
    const a = arrow('a', onArrow('t', 0.25), free(0, 300));
    expect(retiredArrowEnds(a, [target, a]).from).toEqual({ x: 50, y: 25 });
  });

  it('follows on-arrow ends up to four hops, and no further', () => {
    expect(RETIRED_ARROW_MAX_HOPS).toBe(4);
    // a0 runs along the top from x 0 to 100; a1 hangs off a0's middle, a2 off a1's, and so on, each other end on
    // x 0. Only a0 carries any x, so an end reads x above 0 only when its walk reaches a0.
    const chain: RetiredArrowElement[] = [arrow('a0', free(0, 0), free(100, 0))];
    for (let i = 1; i <= 5; i += 1)
      chain.push(arrow(`a${i}`, onArrow(`a${i - 1}`, 0.5), free(0, 100 * i)));
    const at = (i: number) => retiredArrowEnds(chain[i]!, chain).from;
    expect(at(1)).toEqual({ x: 50, y: 0 });
    // Four hops reach a0.
    expect(at(4).x).toBeCloseTo(6.25);
    // Five do not: a1's end four hops in counts as unresolved and takes a1's other end, on x 0.
    expect(at(5).x).toBe(0);
  });

  it('stops a cycle of on-arrow ends and falls back to the other end', () => {
    const a = arrow('a', onArrow('b', 0.5), free(10, 10));
    const b = arrow('b', onArrow('a', 0.5), free(90, 90));
    const ends = retiredArrowEnds(a, [a, b]);
    expect(Number.isFinite(ends.from.x) && Number.isFinite(ends.from.y)).toBe(true);
    expect(ends.to).toEqual({ x: 10, y: 10 });
  });

  it('lets an end that does not resolve take the other end’s point', () => {
    const els = [box('p', 0, 0)];
    const cases: RetiredEndpoint[] = [
      pinned('gone', 'n'),
      onArrow('gone', 0.5),
      { kind: 'pinned', elementId: 'p', anchor: 'middle' as never },
      { kind: 'on-arrow', arrowId: 'p', t: 0.5 },
      { kind: 'on-arrow', arrowId: 'x', t: Number.NaN },
      free(Number.NaN, 0),
      free(0, Number.POSITIVE_INFINITY),
      { kind: 'pinned-group', groupId: 'g', anchor: 's' } as never,
      null as never,
    ];
    for (const end of cases) {
      expect(retiredArrowEnds(arrow('a', end, free(7, 9)), els), JSON.stringify(end)).toEqual({
        from: { x: 7, y: 9 },
        to: { x: 7, y: 9 },
      });
      expect(retiredArrowEnds(arrow('a', free(7, 9), end), els).to).toEqual({ x: 7, y: 9 });
    }
  });

  it('never pins to an arrow or to an element without a box', () => {
    const other = arrow('o', free(0, 0), free(10, 10));
    const broken = { id: 'b', type: 'shape', shape: 'square', x: 0, y: 0, width: 'wide' };
    const a = arrow('a', pinned('o', 'n'), free(5, 5));
    expect(retiredArrowEnds(a, [other, a]).from).toEqual({ x: 5, y: 5 });
    expect(retiredArrowEnds(arrow('a', pinned('b', 'n'), free(5, 5)), [broken]).from).toEqual({
      x: 5,
      y: 5,
    });
  });

  it('sits at the origin when neither end resolves', () => {
    expect(retiredArrowEnds(arrow('a', pinned('gone', 'n'), onArrow('gone', 0.5)), [])).toEqual({
      from: { x: 0, y: 0 },
      to: { x: 0, y: 0 },
    });
  });
});

describe('retiredArrowCard', () => {
  it('is 160 by 96, centred on the line’s middle', () => {
    expect([RETIRED_ARROW_CARD_WIDTH, RETIRED_ARROW_CARD_HEIGHT]).toEqual([160, 96]);
    const card = retiredArrowCard(arrow('a', free(0, 0), free(400, 200)), []);
    expect(card).toEqual({ x: 120, y: 52, width: 160, height: 96 });
  });

  it('follows its pinned element wherever it is, never moving itself', () => {
    const a = arrow('a', pinned('p', 'e'), free(500, 30));
    const at = (x: number) => retiredArrowCard(a, [box('p', x, 0)]);
    expect(at(0).x).toBe((100 + 500) / 2 - 80);
    expect(at(200).x).toBe((300 + 500) / 2 - 80);
    // Its pinned element deleted: the line collapses onto its free end and the card sits there.
    expect(retiredArrowCard(a, [])).toEqual({ x: 420, y: -18, width: 160, height: 96 });
  });
});

describe('retiredArrowBounds', () => {
  it('is the line’s box when it reaches past the card', () => {
    expect(retiredArrowBounds(arrow('a', free(0, 0), free(400, 200)), [])).toEqual({
      x: 0,
      y: 0,
      width: 400,
      height: 200,
    });
  });

  it('is the card when the line is shorter than it', () => {
    expect(retiredArrowBounds(arrow('a', free(100, 100), free(120, 100)), [])).toEqual({
      x: 30,
      y: 52,
      width: 160,
      height: 96,
    });
  });

  it('unions a long thin line with the card', () => {
    expect(retiredArrowBounds(arrow('a', free(0, 0), free(400, 0)), [])).toEqual({
      x: 0,
      y: -48,
      width: 400,
      height: 96,
    });
  });
});

// A tab's bounds read every stored arrow's ends: one index for the tab, not one per arrow, which made them quadratic
// in the arrows (a 300-arrow tab's lint ran 15 times slower than a 75-arrow one's). Timed as growth, not as a
// ceiling, so coverage on a CI runner cannot flake it: four times the arrows, under eight times the CPU.
describe('a tab of stored arrows', () => {
  const tabOf = (n: number): Element[] => {
    const els: Element[] = [];
    for (let i = 0; i < n; i++)
      els.push(box(`b${i}`, (i % 40) * 160, Math.floor(i / 40) * 100) as Element);
    for (let i = 1; i < n; i++)
      els.push(arrow(`a${i}`, pinned(`b${i - 1}`, 'e'), pinned(`b${i}`, 'w')));
    return els;
  };
  // Fastest of seven: one garbage collection on a busy machine moved a fastest-of-five ratio to 8.07 under coverage.
  const fastest = (els: Element[], run: (els: Element[]) => unknown) =>
    Math.min(...Array.from({ length: 7 }, () => cpuMsOf(() => void run(els))));

  it('measures its bounds in time that grows with the arrows, not faster', () => {
    // Four times the arrows: linear work costs about four times as much, a quadratic sixteen.
    const small = tabOf(1000);
    const large = tabOf(4000);
    const bounds = (els: Element[]) => {
      for (let i = 0; i < 5; i++) contentBounds(els);
    };
    expect(fastest(large, bounds) / fastest(small, bounds)).toBeLessThan(8);
  });
});
