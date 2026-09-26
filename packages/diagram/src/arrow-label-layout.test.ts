import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ARROW_LABEL_LAYOUT_OPTIONS,
  KNOCKOUT_MARGIN_PX,
  arrowKnockouts,
  layoutArrowLabels,
  type ArrowLabelLayoutOptions,
} from './arrow-label-layout';
import type { ArrowElement, Element, ShapeElement } from './index';

// 6px per character at 12px, scaled with the font: deterministic stand-in
// for the canvas measure.
const measureFor: ArrowLabelLayoutOptions['measureFor'] = (px) => (s) => s.length * px * 0.5;

const opts = (over: Partial<ArrowLabelLayoutOptions> = {}): Partial<ArrowLabelLayoutOptions> => ({
  measureFor,
  ...over,
});

const free = (x: number, y: number) => ({ kind: 'free' as const, x, y });

const arrow = (
  id: string,
  from: [number, number],
  to: [number, number],
  label: string,
  over: Partial<ArrowElement> = {},
): ArrowElement => ({
  id,
  type: 'arrow',
  from: free(...from),
  to: free(...to),
  label,
  ...over,
});

const box = (
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  over: Partial<ShapeElement> = {},
): ShapeElement => ({ id, type: 'shape', shape: 'square', x, y, width: w, height: h, ...over });

const layoutOf = (els: Element[], id: string, o: Partial<ArrowLabelLayoutOptions> = {}) => {
  const l = layoutArrowLabels(els, opts(o)).get(id);
  if (!l) throw new Error(`no layout for ${id}`);
  return l;
};

const distToSegment = (
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
) => {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const f = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / (vx * vx + vy * vy)));
  return Math.hypot(p.x - (a.x + vx * f), p.y - (a.y + vy * f));
};

describe('layoutArrowLabels: on the line', () => {
  it('centres a label on the middle of the open run, with a knockout', () => {
    const l = layoutOf([arrow('a', [0, 0], [600, 0], 'UI', { arrowEnds: 'both' })], 'a');
    expect(l.mode).toBe('on-line');
    expect(l.center).toEqual({ x: 300, y: 0 });
    expect(l.lines).toEqual(['UI']);
    expect(l.knockout).not.toBeNull();
    const k = l.knockout!;
    expect(k.x).toBeLessThan(300);
    expect(k.x + k.width).toBeGreaterThan(300);
    expect(k.width).toBeCloseTo(l.width + 2 * KNOCKOUT_MARGIN_PX);
  });

  it('keeps clear of the arrowhead, so a one-headed arrow centres off the chord middle', () => {
    const l = layoutOf([arrow('a', [0, 0], [600, 0], 'UI')], 'a');
    expect(l.center.y).toBe(0);
    expect(l.center.x).toBeLessThan(300);
  });

  it('has no entry for an arrow without a label', () => {
    expect(layoutArrowLabels([arrow('a', [0, 0], [600, 0], '')], opts()).has('a')).toBe(false);
  });

  it('sits on the curve itself, not beside its chord', () => {
    const curved = arrow('a', [0, 0], [0, 400], 'Use personal assistant', {
      arrowStyle: 'curved',
      curveOffset: { dx: 160, dy: 0 },
      arrowEnds: 'both',
    });
    const l = layoutOf([curved], 'a');
    expect(l.mode).toBe('on-line');
    // Quadratic through control (160, 200): its apex is x = 80 at y = 200.
    expect(l.center.x).toBeCloseTo(80, 0);
    expect(l.center.y).toBeCloseTo(200, 0);
  });
});

describe('layoutArrowLabels: width', () => {
  const text = 'Use personal assistant'; // 132px on one line

  it('stays on one line when the horizontal run has room', () => {
    expect(layoutOf([arrow('a', [0, 0], [200, 0], text)], 'a').lines).toEqual([text]);
  });

  it('wraps narrower on a shorter horizontal run', () => {
    const l = layoutOf([arrow('a', [0, 0], [150, 0], text)], 'a');
    expect(l.mode).toBe('on-line');
    expect(l.lines).toEqual(['Use personal', 'assistant']);
  });

  it('caps the width across a vertical run however long the arrow is', () => {
    const long = 'Context summarisation for the whole team'; // 240px
    const l = layoutOf([arrow('a', [0, 0], [0, 2000], long)], 'a', { crossCapPx: 160 });
    expect(l.lines.length).toBeGreaterThan(1);
    expect(l.width).toBeLessThanOrEqual(160 + 8);
  });

  it('caps the width along a long horizontal run', () => {
    const long = 'a caption that goes on and on well beyond any sensible single line';
    const l = layoutOf([arrow('a', [0, 0], [3000, 0], long)], 'a', { alongCapPx: 240 });
    expect(l.lines.length).toBeGreaterThan(1);
    expect(l.width).toBeLessThanOrEqual(240 + 8);
  });

  it('keeps explicit line breaks', () => {
    expect(layoutOf([arrow('a', [0, 0], [0, 600], 'Speech\nto text')], 'a').lines).toEqual([
      'Speech',
      'to text',
    ]);
  });
});

describe('layoutArrowLabels: beside the line', () => {
  it('moves beside a route too short to hold the label, without a knockout', () => {
    const l = layoutOf([arrow('a', [0, 0], [60, 0], 'Use personal assistant')], 'a');
    expect(l.mode).toBe('beside');
    expect(l.knockout).toBeNull();
    expect(Math.abs(l.center.y)).toBeGreaterThanOrEqual(l.height / 2);
  });

  it('flips to the other side when the first side is blocked', () => {
    const els = (blockY: number) => [
      box('b', -100, blockY, 300, 60),
      arrow('a', [0, 0], [60, 0], 'Use personal assistant'),
    ];
    const below = layoutOf(els(10), 'a');
    const above = layoutOf(els(-70), 'a');
    expect(Math.sign(below.center.y)).toBe(-1);
    expect(Math.sign(above.center.y)).toBe(1);
  });
});

describe('layoutArrowLabels: obstacles', () => {
  const line = () => arrow('a', [0, 0], [600, 0], 'UI', { arrowEnds: 'both' });

  it('slides along the line, within the middle half, to clear a box', () => {
    const l = layoutOf([box('b', 280, -20, 40, 40), line()], 'a');
    expect(l.center.y).toBe(0);
    expect(l.center.x).not.toBe(300);
    expect(l.center.x).toBeGreaterThanOrEqual(20 + 560 / 4);
    expect(l.center.x).toBeLessThanOrEqual(580 - 560 / 4);
  });

  it('stays in the middle when nowhere is clear', () => {
    expect(layoutOf([box('b', -50, -50, 700, 100), line()], 'a').center).toEqual({ x: 300, y: 0 });
  });

  it('ignores frames, which are backdrops', () => {
    const frame = box('f', -50, -50, 700, 100, { shape: 'frame' });
    expect(layoutOf([frame, line()], 'a').center).toEqual({ x: 300, y: 0 });
  });

  it('avoids a label placed earlier in document order', () => {
    const first = arrow('a', [0, 0], [600, 0], 'UI', { arrowEnds: 'both' });
    const second = arrow('b', [0, 10], [600, 10], 'UI', { arrowEnds: 'both' });
    const map = layoutArrowLabels([first, second], opts());
    expect(map.get('a')!.center).toEqual({ x: 300, y: 0 });
    expect(map.get('b')!.center.x).toBeCloseTo(300 + 560 / 12);
  });
});

describe('layoutArrowLabels: angled strategies', () => {
  // A Z: 300 across, 100 down, 250 across. Chord middle is (275, 50).
  const z = () =>
    arrow('a', [0, 0], [550, 100], 'UI', {
      arrowStyle: 'angled',
      arrowEnds: 'both',
      curvePoints: [
        { dx: 25, dy: -50 },
        { dx: 25, dy: 50 },
      ],
    });
  const at = (angledStrategy: ArrowLabelLayoutOptions['angledStrategy']) =>
    layoutOf([z()], 'a', { angledStrategy }).center;

  it('route-middle centres on the whole route, even on a short segment', () => {
    const c = at('route-middle');
    expect(c.x).toBeCloseTo(300);
    expect(c.y).toBeCloseTo(25);
  });

  it('longest-segment centres on the longest segment', () => {
    expect(at('longest-segment')).toEqual({ x: 154, y: 0 });
  });

  it('middle-segment centres on the segment holding the route middle', () => {
    expect(at('middle-segment')).toEqual({ x: 300, y: 50 });
  });

  it('horizontal-preferred picks the longest horizontal segment that fits', () => {
    expect(at('horizontal-preferred')).toEqual({ x: 154, y: 0 });
  });
});

describe('layoutArrowLabels: placed labels', () => {
  it('keeps a dragged placement and knocks out the line when it sits on it', () => {
    const on = layoutOf(
      [arrow('a', [0, 0], [600, 0], 'UI', { labelOffset: { t: 0.25, offset: 0 } })],
      'a',
    );
    expect(on.mode).toBe('placed');
    expect(on.center).toEqual({ x: 150, y: 0 });
    expect(on.knockout).not.toBeNull();
  });

  it('has no knockout when dragged clear of the line', () => {
    const off = layoutOf(
      [arrow('a', [0, 0], [600, 0], 'UI', { labelOffset: { t: 0.5, offset: 40 } })],
      'a',
    );
    expect(off.knockout).toBeNull();
  });
});

describe('arrowKnockouts', () => {
  const els = (): Element[] => [
    arrow('a', [0, 0], [600, 0], 'UI', { arrowEnds: 'both' }),
    arrow('b', [300, -200], [300, 200], ''),
  ];

  it('gives an arrow its own knockout only by default', () => {
    const map = layoutArrowLabels(els(), opts());
    expect(arrowKnockouts('a', els(), map, false)).toHaveLength(1);
    expect(arrowKnockouts('b', els(), map, false)).toHaveLength(0);
  });

  it('cuts a crossing arrow too when knockoutOthers is on', () => {
    const map = layoutArrowLabels(els(), opts());
    expect(arrowKnockouts('b', els(), map, true)).toHaveLength(1);
  });
});

describe('DEFAULT_ARROW_LABEL_LAYOUT_OPTIONS', () => {
  it('is complete without a measure, which falls back to labelMeasure', () => {
    expect(DEFAULT_ARROW_LABEL_LAYOUT_OPTIONS.measureFor).toBeUndefined();
    const l = layoutArrowLabels([arrow('a', [0, 0], [600, 0], 'UI')]).get('a');
    expect(l?.mode).toBe('on-line');
  });

  it('keeps every on-line centre on its route', () => {
    const a = arrow('a', [10, 20], [400, 330], 'Speech to text');
    const l = layoutOf([a], 'a');
    expect(distToSegment(l.center, { x: 10, y: 20 }, { x: 400, y: 330 })).toBeLessThan(0.5);
  });
});

describe('layoutArrowLabels: refinements from the bench', () => {
  it('never lets a knockout bite into the next segment round a corner', () => {
    // L: 100 across, then 400 down. On the short leg the two-line block's
    // knockout would reach down the long leg; it must not.
    const l = layoutOf(
      [
        arrow('a', [0, 0], [100, 400], 'after 30 days', {
          arrowStyle: 'angled',
          curvePoints: [{ dx: 50, dy: -200 }],
        }),
      ],
      'a',
      { angledStrategy: 'longest-segment' },
    );
    expect(l.center.x).toBeCloseTo(100);
    const k = l.knockout!;
    // The corner (100, 0) stays outside the cut.
    expect(k.y).toBeGreaterThan(0);
  });

  it('wraps a beside label narrower to clear the boxes either side', () => {
    const els = [
      box('a', 0, 0, 160, 80),
      box('b', 250, 0, 160, 80),
      arrow('ar', [160, 40], [250, 40], 'Validates the signed request payload'),
    ];
    const l = layoutOf(els, 'ar');
    expect(l.mode).toBe('beside');
    expect(l.center.x - l.width / 2).toBeGreaterThanOrEqual(160);
    expect(l.center.x + l.width / 2).toBeLessThanOrEqual(250);
  });

  it('horizontal-preferred skips a horizontal leg that would need more lines', () => {
    // 100 across then 400 down: the short leg can only hold the label on two
    // lines, the long leg on one, so the long leg wins.
    const l = layoutOf(
      [
        arrow('a', [0, 0], [100, 400], 'after 30 days', {
          arrowStyle: 'angled',
          curvePoints: [{ dx: 50, dy: -200 }],
        }),
      ],
      'a',
      { angledStrategy: 'horizontal-preferred' },
    );
    expect(l.lines).toEqual(['after 30 days']);
    expect(l.center.x).toBeCloseTo(100);
  });
});
