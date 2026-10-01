import { describe, expect, it, vi } from 'vitest';
import {
  applyArrowDragMove,
  type ArrowDragMoveArgs,
  type ArrowDragState,
} from './arrow-drag-apply';
import { planArrowBend, type ArrowElement, type Element } from '@livediagram/document';

// A free-floating arrow: no pinned ends, so translate/endpoint maths stay
// self-contained and don't need surrounding boxes to anchor against.
function arrow(over: Partial<Element> = {}): Element {
  return {
    id: 'a1',
    type: 'arrow',
    from: { kind: 'free', x: 0, y: 0 },
    to: { kind: 'free', x: 100, y: 0 },
    ...over,
  } as Element;
}

// Runs the applier against one element list and returns what `tick` produced,
// plus the guide/telemetry calls it made along the way.
function run(drag: ArrowDragState, over: Partial<ArrowDragMoveArgs> = {}) {
  const els = [arrow()];
  let out: Element[] = els;
  const scheduleGuides = vi.fn();
  const scheduleSnapTargets = vi.fn();
  const onArrowConnected = vi.fn();
  applyArrowDragMove({
    drag,
    dx: 10,
    dy: 20,
    noSnap: false,
    shiftHeld: false,
    elements: els,
    guidesOn: true,
    tick: (mapper) => {
      out = mapper(out);
    },
    scheduleGuides,
    scheduleSnapTargets,
    onArrowConnected,
    ...over,
  });
  return { out, scheduleGuides, scheduleSnapTargets, onArrowConnected };
}

describe('applyArrowDragMove', () => {
  it('translates both free endpoints by the same delta', () => {
    // The one kind with no snap ladder at all: the user chose a floating
    // arrow, so both ends move rigidly with the cursor.
    const { out } = run({
      kind: 'arrow-translate',
      arrowId: 'a1',
      startClientX: 0,
      startClientY: 0,
      startFromX: 0,
      startFromY: 0,
      startToX: 100,
      startToY: 0,
    } as ArrowDragState);
    const a = out[0] as Element & {
      from: { x: number; y: number };
      to: { x: number; y: number };
    };
    expect(a.from).toEqual({ kind: 'free', x: 10, y: 20 });
    expect(a.to).toEqual({ kind: 'free', x: 110, y: 20 });
  });

  it('leaves other elements untouched', () => {
    // The mappers match on arrowId; a second arrow must pass through
    // by identity so React can skip re-rendering it.
    const other = arrow({ id: 'a2' });
    const els = [arrow(), other];
    let out: Element[] = els;
    applyArrowDragMove({
      drag: {
        kind: 'arrow-translate',
        arrowId: 'a1',
        startClientX: 0,
        startClientY: 0,
        startFromX: 0,
        startFromY: 0,
        startToX: 100,
        startToY: 0,
      } as ArrowDragState,
      dx: 5,
      dy: 5,
      noSnap: false,
      shiftHeld: false,
      elements: els,
      guidesOn: true,
      tick: (mapper) => {
        out = mapper(out);
      },
      scheduleGuides: vi.fn(),
      scheduleSnapTargets: vi.fn(),
      onArrowConnected: vi.fn(),
    });
    expect(out[1]).toBe(other);
  });

  it('suppresses curve guides when the alignment-guides preference is off', () => {
    // guidesOn is docs/specs/008-canvas/snap-override.md's preference. Off means the geometry still
    // updates, but no guide lines are drawn.
    const drag = {
      kind: 'arrow-curve',
      arrowId: 'a1',
      startClientX: 0,
      startClientY: 0,
      startMidX: 50,
      startMidY: 0,
      grabDx: 0,
      grabDy: 0,
    } as ArrowDragState;
    const on = run(drag, { guidesOn: true });
    const off = run(drag, { guidesOn: false });
    expect(off.scheduleGuides).toHaveBeenCalledWith([]);
    // The curve itself is written either way.
    expect((on.out[0] as Element & { curveOffset?: unknown }).curveOffset).toBeDefined();
    expect((off.out[0] as Element & { curveOffset?: unknown }).curveOffset).toBeDefined();
  });

  it('does not fire the connected callback on an ordinary endpoint move', () => {
    // onArrowConnected is telemetry for landing on ANOTHER arrow; a drag
    // through empty canvas must stay silent (the caller's once-guard can
    // only suppress repeats, not a spurious first call).
    const { onArrowConnected } = run({
      kind: 'arrow-endpoint',
      arrowId: 'a1',
      end: 'to',
      startClientX: 0,
      startClientY: 0,
      startCanvasX: 100,
      startCanvasY: 0,
      reposition: true,
    } as ArrowDragState);
    expect(onArrowConnected).not.toHaveBeenCalled();
  });

  it('bends the arrow by the plan made at the press', () => {
    // A straight arrow grabbed at its middle and dragged down bows through
    // the pointer (docs/specs/008-canvas/arrow-bending.md).
    const plan = planArrowBend(arrow() as ArrowElement, [], { x: 50, y: 0 });
    const { out } = run({
      kind: 'arrow-bend',
      arrowId: 'a1',
      startClientX: 0,
      startClientY: 0,
      plan,
    } as ArrowDragState);
    const a = out[0] as ArrowElement;
    expect(a.arrowStyle).toBe('curved');
    expect(a.curveOffset).toBeDefined();
  });

  it('scales a free arrow from its frame, holding the opposite side', () => {
    const { out } = run({
      kind: 'arrow-scale',
      arrowId: 'a1',
      handle: 'e',
      startClientX: 0,
      startClientY: 0,
      box: { x: 0, y: 0, width: 100, height: 0 },
      start: arrow() as ArrowElement,
    } as ArrowDragState);
    const a = out[0] as ArrowElement;
    expect(a.from).toEqual({ kind: 'free', x: 0, y: 0 });
    expect(a.to.kind === 'free' && a.to.x).toBeCloseTo(110);
    expect(a.to.kind === 'free' && a.to.y).toBe(0);
  });
});

// docs/specs/008-canvas/arrow-bending.md "Bends line up": a slid angled segment snaps to
// another arrow's bend.
describe('sliding an angled segment', () => {
  // A runs (0,0) → (100,0) → (100,100) → (200,100): its middle segment is vertical at x = 100.
  const a = {
    id: 'a1',
    type: 'arrow',
    arrowStyle: 'angled',
    from: { kind: 'free', x: 0, y: 0 },
    to: { kind: 'free', x: 200, y: 100 },
    curvePoints: [
      { dx: 0, dy: -50 },
      { dx: 0, dy: 50 },
    ],
  } as ArrowElement;
  // B turns at x = 106.
  const b = {
    id: 'b1',
    type: 'arrow',
    arrowStyle: 'angled',
    from: { kind: 'free', x: 0, y: 300 },
    to: { kind: 'free', x: 200, y: 400 },
    curvePoints: [
      { dx: 6, dy: -50 },
      { dx: 6, dy: 50 },
    ],
  } as ArrowElement;

  const slide = (noSnap: boolean) => {
    const els: Element[] = [a, b];
    let out = els;
    const scheduleGuides = vi.fn();
    applyArrowDragMove({
      drag: {
        kind: 'arrow-bend',
        arrowId: 'a1',
        startClientX: 0,
        startClientY: 0,
        plan: planArrowBend(a, els, { x: 100, y: 50 }),
      } as ArrowDragState,
      dx: 3,
      dy: 0,
      noSnap,
      shiftHeld: false,
      elements: els,
      guidesOn: true,
      tick: (m) => {
        out = m(out);
      },
      scheduleGuides,
      scheduleSnapTargets: vi.fn(),
      onArrowConnected: vi.fn(),
    });
    const moved = out[0] as ArrowElement;
    return {
      xs: moved.curvePoints!.map((p) => 100 + p.dx),
      guides: scheduleGuides.mock.lastCall![0],
    };
  };

  it('lines the segment up with the other arrow’s bend, with a guide', () => {
    const { xs, guides } = slide(false);
    expect(xs).toEqual([106, 106]);
    expect(guides).toEqual([expect.objectContaining({ axis: 'x', position: 106 })]);
  });

  it('slides freely with snapping off', () => {
    const { xs } = slide(true);
    expect(xs).toEqual([103, 103]);
  });
});
