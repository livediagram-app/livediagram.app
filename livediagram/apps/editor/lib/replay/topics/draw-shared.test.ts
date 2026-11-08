import { describe, expect, it } from 'vitest';
import type { Element, Tab } from '@livediagram/document';
import { makeCommitFreehand, type PenInk } from '@/hooks/canvas/commit-freehand';
import { whiteboardPenIntent } from '@/lib/whiteboard-tool';
import {
  dockItemSelector,
  handLine,
  inkAt,
  INK_PEN,
  penInHand,
  penStroke,
  recognised,
  snappedShape,
  THICK_PX,
  type Pen,
} from './draw-shared';

// What Draw's topics draw must be exactly what the pen lands (docs/specs/007-editor/watch-it-built.md "The replay":
// "the chrome is real"): each demo stroke and snapped shape is checked against the real commit.

const tab = { id: 't', elements: [], backgroundColor: '#ffffff' } as unknown as Tab;

// What a whiteboard pen in `pen` commits for these points, as a mouse draws them.
function landed(points: { x: number; y: number }[], pen: Pen, ink: Partial<PenInk> = {}): Element {
  let out: Element | null = null;
  const commit = makeCommitFreehand({
    editsBlocked: false,
    activeTab: tab,
    commit: (fn) => {
      out = fn([])[0]!;
    },
    pendingDraw: whiteboardPenIntent({ id: 'second', ...pen }, false),
    setPendingDraw: () => {},
    setSelectedId: () => {},
    zoomRef: { current: 1 },
  });
  commit(points, false, { streamline: 0.5, ...ink });
  return out!;
}
const sansId = (el: Element) => ({ ...el, id: '' });

const square = handLine(
  [
    { x: 0, y: 0 },
    { x: 140, y: 4 },
    { x: 136, y: 120 },
    { x: -2, y: 116 },
    { x: 2, y: 4 },
  ],
  12,
  3,
);

describe('penStroke', () => {
  it('is the stroke a mouse lands with the pen, for the ink and for a stock colour', () => {
    for (const pen of [INK_PEN, { colour: 'green', width: THICK_PX }] as Pen[]) {
      const pts = handLine(
        [
          { x: 10, y: 10 },
          { x: 90, y: 40 },
        ],
        20,
      );
      expect(sansId(penStroke('wib-x', pts, pen))).toEqual(sansId(landed(pts, pen)));
    }
  });
});

describe('snappedShape', () => {
  it('reads a rough box as a rectangle, and lands it as the pen lands a snapped stroke', () => {
    const detected = recognised(square, INK_PEN);
    expect(detected?.kind).toBe('square');
    const shape = snappedShape('wib-s', detected!, INK_PEN);
    expect(sansId(shape)).toEqual(sansId(landed(square, INK_PEN, { snapped: detected! })));
    expect(shape).toMatchObject({ fillColor: 'transparent', penColour: 'ink' });
  });
});

describe('inkAt', () => {
  const stroke = {
    id: 'wib-a',
    points: square,
    from: 1000,
    to: 3000,
    pen: INK_PEN,
  };

  it('draws nothing before a stroke starts, then grows it with the cursor on its tip', () => {
    expect(inkAt([stroke], 999)).toEqual({ elements: [], hold: null });
    const early = inkAt([stroke], 1200);
    const late = inkAt([stroke], 2600);
    expect(early.elements).toHaveLength(1);
    expect(late.elements[0]!.packedPoints.length).toBeGreaterThan(
      early.elements[0]!.packedPoints.length,
    );
    expect(late.hold).not.toBeNull();
    expect(square).toContainEqual(late.hold);
  });

  it('lets go once it is drawn, the whole stroke landed', () => {
    const done = inkAt([stroke], 3000);
    expect(done.hold).toBeNull();
    expect(done.elements[0]).toEqual(penStroke('wib-a', square, INK_PEN));
  });
});

describe('the dock', () => {
  it('finds a dock button inside the dock, and shows a marker in hand', () => {
    expect(dockItemSelector('main')).toBe('[data-whiteboard-dock] [data-dock-item="main"]');
    expect(penInHand('second', { prefs: { recognise: true } })).toEqual({
      tool: 'pen',
      prefs: { recognise: true, activePenId: 'second' },
    });
  });
});
