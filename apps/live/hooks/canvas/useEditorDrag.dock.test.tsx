// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PointerEvent as ReactPointerEvent } from 'react';
import {
  dockedBounds,
  ES_DOCK_SNAP_PX,
  type Element,
  type StickyElement,
  type Tab,
} from '@livediagram/diagram';
import { getDockCandidate, setDockCandidate } from '@/lib/dock-preview';
import { track } from '@/lib/telemetry';
import { useEditorDrag } from './useEditorDrag';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
import type { EditorDragDeps } from './useEditorDrag.types';

// Magnetic docking through the real drag machine (spec/139 Phase 7): the
// offer, the drop that stamps it, the drag away that lets it go, the cluster
// that moves as one, and the modifiers that suppress the whole thing.

function note(id: string, kind: string, x: number, y = 500, over: Partial<StickyElement> = {}) {
  return {
    id,
    type: 'sticky',
    esKind: kind,
    fixedSize: true,
    x,
    y,
    width: 200,
    height: 200,
    ...over,
  } as StickyElement;
}

const HOST = note('e', 'domain-event', 1000);
const FACE = dockedBounds(HOST, 'before', 'command');

function harness(opts: { elements?: Element[]; esBoard?: boolean; multiSelected?: string[] } = {}) {
  let elements = opts.elements ?? [HOST, note('c', 'command', 0, 0)];
  const history: Element[][] = [];
  const deps = {
    get activeTab() {
      return {
        id: 't',
        name: 'Board',
        kind: 'event-storming',
        elements,
        ...(opts.lanes ? { esTimeline: { originX: 0, originY: 0, enabled: true } } : {}),
      } as Tab;
    },
    zoomRef: { current: 1 },
    selectedId: 'c',
    setSelectedId: vi.fn(),
    soloSelectedId: null,
    setSoloSelectedId: vi.fn(),
    multiSelectedIds: new Set<string>(opts.multiSelected ?? []),
    setMultiSelectedIds: vi.fn(),
    editingId: null,
    isReadOnly: false,
    layerInertIds: new Set<string>(),
    formatSourceId: null,
    applyFormatFromSource: vi.fn(),
    formatToolActive: false,
    setFormatSourceId: vi.fn(),
    groupSourceId: null,
    completeGrouping: vi.fn(),
    connectSourceId: null,
    connectArrowTo: vi.fn(),
    tick: (m: (els: Element[]) => Element[]) => {
      elements = m(elements);
    },
    commit: (m: (els: Element[]) => Element[]) => {
      history.push(elements);
      elements = m(elements);
    },
    markCheckpoint: () => {
      history.push(elements);
      return history.length;
    },
    cancelToCheckpoint: () => {
      elements = history.pop() ?? elements;
    },
    scheduleElementChangeLog: vi.fn(),
    autoRebindArrowsRef: { current: false },
    alignmentGuidesRef: { current: true },
    isPinchingRef: { current: false },
    insertGate: {
      esBoard: opts.esBoard !== false,
      readOnly: false,
      tabLocked: false,
      createBlocked: false,
    },
  } as unknown as EditorDragDeps;

  const view = renderHook(() => useEditorDrag(deps));
  return {
    ...view,
    byId: (id: string) => elements.find((el) => el.id === id) as StickyElement,
    get checkpoints() {
      return history.length;
    },
  };
}

type Harness = ReturnType<typeof harness>;
const START = { x: 100, y: 600 };

function press(h: Harness, id: string) {
  act(() => {
    h.result.current.beginDrag(id, 'move', {
      clientX: START.x,
      clientY: START.y,
      button: 0,
      stopPropagation: vi.fn(),
      preventDefault: vi.fn(),
      currentTarget: document.createElement('div'),
    } as unknown as ReactPointerEvent);
  });
}

function move(h: Harness, dx: number, dy: number, mods: { shift?: boolean; meta?: boolean } = {}) {
  act(() => {
    window.dispatchEvent(
      new MouseEvent('pointermove', {
        clientX: START.x + dx,
        clientY: START.y + dy,
        shiftKey: mods.shift === true,
        metaKey: mods.meta === true,
      }),
    );
  });
}

function release(h: Harness, dx: number, dy: number) {
  act(() => {
    window.dispatchEvent(
      new MouseEvent('pointerup', { clientX: START.x + dx, clientY: START.y + dy }),
    );
  });
}

// From (0, 0) onto the event's BEFORE face, a few px shy of exact.
const TO_FACE = { dx: FACE.x + 6, dy: FACE.y + 6 };

beforeEach(() => setDockCandidate(null));
afterEach(() => {
  cleanup();
  setDockCandidate(null);
  vi.mocked(track).mockClear();
});

describe('useEditorDrag — magnetic docking (spec/139)', () => {
  it('offers the face a compatible note comes near', () => {
    const h = harness();
    press(h, 'c');
    move(h, TO_FACE.dx, TO_FACE.dy);
    expect(getDockCandidate()).toMatchObject({ hostId: 'e', side: 'before' });
  });

  it('carries the note exactly onto the face while the offer stands', () => {
    const h = harness();
    press(h, 'c');
    move(h, TO_FACE.dx, TO_FACE.dy);
    expect(h.byId('c')).toMatchObject({ x: FACE.x, y: FACE.y });
  });

  it('lets go beyond the snap distance', () => {
    const h = harness();
    press(h, 'c');
    move(h, TO_FACE.dx + ES_DOCK_SNAP_PX + 5, TO_FACE.dy);
    expect(getDockCandidate()).toBeNull();
  });

  it('stamps the relation on the drop, in the gesture’s own step', () => {
    const h = harness();
    press(h, 'c');
    move(h, TO_FACE.dx, TO_FACE.dy);
    const steps = h.checkpoints;
    release(h, TO_FACE.dx, TO_FACE.dy);
    expect(h.byId('c').esDock).toEqual({ hostId: 'e', side: 'before' });
    expect(h.checkpoints).toBe(steps);
    expect(track).toHaveBeenCalledWith('Canvas', 'Used', 'Dock');
    expect(getDockCandidate()).toBeNull();
  });

  it('undocks a docked note dragged away', () => {
    const docked = note('c', 'command', FACE.x, FACE.y, {
      esDock: { hostId: 'e', side: 'before' },
    });
    const h = harness({ elements: [HOST, docked] });
    press(h, 'c');
    move(h, -600, 400);
    release(h, -600, 400);
    expect('esDock' in h.byId('c')).toBe(false);
    expect(track).toHaveBeenCalledWith('Canvas', 'Used', 'Undock');
  });

  it('leaves a docked note docked when it is only nudged', () => {
    const docked = note('c', 'command', FACE.x, FACE.y, {
      esDock: { hostId: 'e', side: 'before' },
    });
    const h = harness({ elements: [HOST, docked] });
    press(h, 'c');
    move(h, 9, 7);
    release(h, 9, 7);
    expect(h.byId('c').esDock).toEqual({ hostId: 'e', side: 'before' });
    // It snapped back onto the face rather than sitting 9px off it.
    expect(h.byId('c').x).toBe(FACE.x);
  });

  it('carries a host’s docked notes with it', () => {
    const docked = note('c', 'command', FACE.x, FACE.y, {
      esDock: { hostId: 'e', side: 'before' },
    });
    const h = harness({ elements: [HOST, docked] });
    press(h, 'e');
    move(h, 300, 0);
    expect(h.byId('e').x).toBe(1300);
    expect(h.byId('c').x).toBe(FACE.x + 300);
  });

  it('never moves a docked note twice when the selection holds both', () => {
    const docked = note('c', 'command', FACE.x, FACE.y, {
      esDock: { hostId: 'e', side: 'before' },
    });
    const h = harness({ elements: [HOST, docked], multiSelected: ['e', 'c'] });
    press(h, 'e');
    move(h, 300, 0);
    expect(h.byId('c').x).toBe(FACE.x + 300);
  });

  it('stands down under free placement', () => {
    const h = harness();
    press(h, 'c');
    move(h, TO_FACE.dx, TO_FACE.dy, { meta: true });
    expect(getDockCandidate()).toBeNull();
    expect(h.byId('c').x).toBe(TO_FACE.dx);
  });

  it('stands down while Shift owns the gesture', () => {
    const h = harness();
    press(h, 'c');
    move(h, TO_FACE.dx, TO_FACE.dy, { shift: true });
    expect(getDockCandidate()).toBeNull();
  });

  it('does nothing on an ordinary board', () => {
    const h = harness({ esBoard: false });
    press(h, 'c');
    move(h, TO_FACE.dx, TO_FACE.dy);
    expect(getDockCandidate()).toBeNull();
  });

  it('lands the HOST on the lane, and the docked note follows it', () => {
    const docked = note('c', 'command', FACE.x, FACE.y, {
      esDock: { hostId: 'e', side: 'before' },
    });
    const h = harness({ elements: [HOST, docked], lanes: true });
    press(h, 'e');
    // Aim the host a few px off lane 2 / column 12.
    move(h, 12 * 100 + 7 - 1000, 2 * 240 + 9 - 500);
    // The host is on the grid…
    expect(h.byId('e').x).toBe(12 * 100);
    expect(h.byId('e').y).toBe(2 * 240);
    // …and the pair is still a pair, at exactly its seam.
    expect(h.byId('c').x).toBe(12 * 100 - 16 - 200);
    expect(h.byId('c').y).toBe(h.byId('e').y);
  });

  it('never offers a pairing the notation does not have', () => {
    const h = harness({ elements: [HOST, note('a', 'actor', 0, 0)] });
    press(h, 'a');
    move(h, TO_FACE.dx, TO_FACE.dy);
    expect(getDockCandidate()).toBeNull();
  });
});
