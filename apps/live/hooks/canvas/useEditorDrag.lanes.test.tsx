// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PointerEvent as ReactPointerEvent } from 'react';
import {
  ES_LANE_PITCH,
  laneCentre,
  type Element,
  type EsTimeline,
  type StickyElement,
  type Tab,
} from '@livediagram/diagram';
import { getLanePreview, setLanePreview } from '@/lib/lane-preview';
import { setInsertionSlot } from '@/lib/insertion-preview';
import { useEditorDrag } from './useEditorDrag';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
import type { EditorDragDeps } from './useEditorDrag.types';

// Timeline lanes on a drag of a note ALREADY on the board (spec/139 Phase 6),
// driven through the real drag machine: the lit lane, the landing, the rungs
// above it (an Alt slot, free placement), and the things that never snap.

const TIMELINE: EsTimeline = { originY: 0 };

function note(id: string, x: number, y = 0): StickyElement {
  return { id, type: 'sticky', x, y, width: 200, height: 200, label: id } as StickyElement;
}

// `drag` starts at (1000, 1000) — clear of every lane and column, so any
// snapping in evidence is the one the test asked for.
const BOARD = (): Element[] => [note('a', 0), note('b', 272), note('drag', 1000, 1000)];

function harness(
  opts: {
    elements?: Element[];
    esBoard?: boolean;
    multiSelected?: string[];
  } = {},
) {
  let elements = opts.elements ?? BOARD();
  const history: Element[][] = [];
  const deps = {
    get activeTab() {
      return {
        id: 't',
        name: 'Tab',
        elements,
      } as Tab;
    },
    zoomRef: { current: 1 },
    selectedId: 'drag',
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
    xOf: (id: string) => (elements.find((el) => el.id === id) as StickyElement | undefined)?.x,
    yOf: (id: string) => (elements.find((el) => el.id === id) as StickyElement | undefined)?.y,
  };
}

type Harness = ReturnType<typeof harness>;

const START = { x: 1200, y: 1200 };

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

function move(
  h: Harness,
  dx: number,
  dy: number,
  mods: { alt?: boolean; shift?: boolean; meta?: boolean } = {},
) {
  act(() => {
    window.dispatchEvent(
      new MouseEvent('pointermove', {
        clientX: START.x + dx,
        clientY: START.y + dy,
        altKey: mods.alt === true,
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

beforeEach(() => {
  setLanePreview(null);
  setInsertionSlot(null);
});
afterEach(() => {
  cleanup();
  setLanePreview(null);
  setInsertionSlot(null);
});

describe('useEditorDrag — timeline lanes (spec/139)', () => {
  // Aim the note's top-left a few px off lane 1, and a few px off the left
  // edge of the note 'b' already on the board — the column that EXISTS.
  // 9px off, which is past the ordinary alignment threshold (6) and inside
  // the lanes neighbour threshold (12): so anything that lands on 272 here
  // landed there because of LANES, not the guides every board has.
  const TARGET = { x: 272 + 9, y: ES_LANE_PITCH + 7 };
  const DX = TARGET.x - 1000;
  const DY = TARGET.y - 1000;

  it('lights the lane the note is landing on', () => {
    const h = harness();
    press(h, 'drag');
    move(h, DX, DY);
    expect(getLanePreview()).toMatchObject({ laneIndex: 1 });
  });

  it('lands the note centred on that lane, lined up with the note below', () => {
    const h = harness();
    press(h, 'drag');
    move(h, DX, DY);
    expect(h.xOf('drag')).toBe(272);
    expect(h.yOf('drag')).toBe(laneCentre(1, TIMELINE) - 100);
  });

  it('clears the lit lane on drop', () => {
    const h = harness();
    press(h, 'drag');
    move(h, DX, DY);
    release(h, DX, DY);
    expect(getLanePreview()).toBeNull();
  });

  it('clears the lit lane when the gesture is abandoned with Escape', () => {
    const h = harness();
    press(h, 'drag');
    move(h, DX, DY);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(getLanePreview()).toBeNull();
  });

  it('leaves a note parked BETWEEN two lanes where it was put', () => {
    const h = harness();
    press(h, 'drag');
    // Half a pitch below lane 1's centred position: no lane can claim it.
    const midY = ES_LANE_PITCH + 100;
    move(h, DX, midY - 1000);
    expect(h.yOf('drag')).toBe(midY);
    expect(getLanePreview()).toBeNull();
  });

  it('stands down under free placement (Cmd/Ctrl)', () => {
    const h = harness();
    press(h, 'drag');
    move(h, DX, DY, { meta: true });
    expect(h.xOf('drag')).toBe(TARGET.x);
    expect(h.yOf('drag')).toBe(TARGET.y);
    expect(getLanePreview()).toBeNull();
  });

  it('stands down for an open insertion slot (Alt over a gap)', () => {
    const h = harness();
    press(h, 'drag');
    // Into the a|b gap: cursor travel puts the note's centre at (236, 100).
    move(h, 236 - 1100, 100 - 1100, { alt: true });
    expect(getLanePreview()).toBeNull();
    expect(h.xOf('drag')).toBe(272);
  });

  it('snaps a MULTI-SELECTION as one block, keeping its spacing', () => {
    // Two notes already a gutter apart, dragged together: the block takes a
    // place on the board and the pair stays a pair.
    const h = harness({ multiSelected: ['drag', 'a'] });
    const before = h.xOf('drag')! - h.xOf('a')!;
    press(h, 'drag');
    move(h, DX, DY);
    expect(getLanePreview()).not.toBeNull();
    expect(h.xOf('drag')! - h.xOf('a')!).toBe(before);
  });

  it('does nothing on an ordinary board', () => {
    const h = harness({ esBoard: false });
    press(h, 'drag');
    move(h, DX, DY);
    expect(getLanePreview()).toBeNull();
    expect(h.xOf('drag')).toBe(TARGET.x);
  });

  it('lands a Shift-duplicate CLONE on the lane too', () => {
    const h = harness();
    press(h, 'drag');
    // The first Shift frame parks the originals and hands the cursor a fresh
    // clone; the frames after it are an ordinary note drag, grid and all.
    move(h, DX, DY, { shift: true });
    move(h, DX, DY, { shift: true });
    const cloneIds = h.result.current.shiftDupGhostIds;
    expect(cloneIds).not.toBeNull();
    expect(getLanePreview()).toMatchObject({ laneIndex: 1 });
    // The original is back where it was grabbed; the clone is on the lane.
    expect(h.xOf('drag')).toBe(1000);
    const cloneId = [...cloneIds!][0]!;
    expect(h.xOf(cloneId)).toBe(272);
    expect(h.yOf(cloneId)).toBe(laneCentre(1, TIMELINE) - 100);
  });

  it('never snaps a shape — the lanes are a note grammar', () => {
    const shape = {
      id: 'drag',
      type: 'shape',
      shape: 'square',
      x: 1000,
      y: 1000,
      width: 200,
      height: 200,
    } as unknown as Element;
    const h = harness({ elements: [note('a', 0), shape] });
    press(h, 'drag');
    move(h, DX, DY);
    expect(getLanePreview()).toBeNull();
    expect(h.xOf('drag')).toBe(TARGET.x);
  });
});
