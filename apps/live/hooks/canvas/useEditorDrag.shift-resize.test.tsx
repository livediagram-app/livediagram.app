// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createAnnotation,
  createComponent,
  createFreehand,
  createImage,
  createLinkCard,
  createPath,
  createShape,
  createSticky,
  createTable,
  createText,
  createVideo,
  isBoxed,
  type Element,
  type Tab,
  type TabKind,
} from '@livediagram/document';
import type { DragMode } from '@/lib/canvas';
import { useEditorDrag } from './useEditorDrag';
import type { EditorDragDeps } from './useEditorDrag.types';

// Shift keeps the aspect ratio everywhere (docs/specs/008-canvas/canvas-and-palette.md "Resize"),
// through the whole drag machine: every boxed kind, every tab kind, and Shift pressed or released
// mid-drag taking effect on the next pointer move.

const COLOURS = { accent: '#0284c7', surface: '#ffffff', ink: '#0f172a' };

// One of every boxed kind, each resized from its own start size.
const KINDS: [string, () => Element][] = [
  ['square', () => createShape('square', 0, 0)],
  ['circle', () => createShape('circle', 0, 0)],
  ['diamond', () => createShape('diamond', 0, 0)],
  ['cylinder', () => createShape('cylinder', 0, 0)],
  ['frame', () => createShape('frame', 0, 0)],
  ['sticky', () => createSticky(0, 0)],
  ['text', () => createText(0, 0)],
  ['image', () => createImage(0, 0)],
  ['table', () => createTable(0, 0)],
  ['link card', () => createLinkCard(0, 0)],
  ['video', () => createVideo(0, 0)],
  ['annotation', () => createAnnotation(0, 0)],
  [
    'freehand stroke',
    () =>
      createFreehand(
        [
          { x: 0, y: 0 },
          { x: 90, y: 30 },
          { x: 160, y: 70 },
        ],
        false,
      ),
  ],
  [
    'path',
    () =>
      createPath(
        [
          { x: 0, y: 0, mode: 'corner' },
          { x: 120, y: 40, mode: 'corner' },
          { x: 60, y: 90, mode: 'corner' },
        ],
        false,
      ),
  ],
  ['banner component', () => createComponent('banner', 200, 100, COLOURS)],
  ['avatar component', () => createComponent('avatar', 200, 100, COLOURS)],
];

function harness(element: Element, kind: TabKind = 'diagram', drawMode = false) {
  let elements: Element[] = [element];
  const deps = {
    get activeTab() {
      return { id: 't', name: 'Tab', kind, elements } as Tab;
    },
    drawMode,
    zoomRef: { current: 1 },
    selectedId: element.id,
    setSelectedId: vi.fn(),
    multiSelectedIds: new Set<string>(),
    setMultiSelectedIds: vi.fn(),
    editingId: null,
    isReadOnly: false,
    layerInertIds: new Set<string>(),
    formatSourceId: null,
    applyFormatFromSource: vi.fn(),
    formatToolActive: false,
    setFormatSourceId: vi.fn(),
    connectSourceId: null,
    connectArrowTo: vi.fn(),
    tick: (m: (els: Element[]) => Element[]) => {
      elements = m(elements);
    },
    commit: (m: (els: Element[]) => Element[]) => {
      elements = m(elements);
    },
    markCheckpoint: () => 1,
    cancelToCheckpoint: vi.fn(),
    scheduleElementChangeLog: vi.fn(),
    autoRebindArrowsRef: { current: false },
    alignmentGuidesRef: { current: false },
    isPinchingRef: { current: false },
    insertGate: { esBoard: false, readOnly: false, tabLocked: false, createBlocked: false },
  } as unknown as EditorDragDeps;
  const view = renderHook(() => useEditorDrag(deps));
  const current = () => {
    const el = elements.find((e) => e.id === element.id);
    if (!el || !isBoxed(el)) throw new Error('element lost');
    return el;
  };
  const press = (mode: DragMode) =>
    act(() => {
      view.result.current.beginDrag(element.id, mode, {
        clientX: 0,
        clientY: 0,
        button: 0,
        stopPropagation: () => {},
        preventDefault: () => {},
      } as unknown as Parameters<typeof view.result.current.beginDrag>[2]);
    });
  return { press, current };
}

function move(x: number, y: number, shiftKey: boolean) {
  act(() => {
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: x, clientY: y, shiftKey }));
  });
}

function release() {
  act(() => {
    window.dispatchEvent(new MouseEvent('pointerup', { clientX: 0, clientY: 0 }));
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

// Frames run synchronously, so each move lands at once.
function syncFrames() {
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(0);
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});
}

const ratio = (el: { width: number; height: number }) => el.width / el.height;

describe('Shift resize, every boxed kind', () => {
  it.each(KINDS)('keeps the ratio of a %s from a corner', (_, make) => {
    syncFrames();
    const el = make();
    const start = ratio(el as never);
    const h = harness(el);
    h.press('resize-se');
    move(90, 13, true);
    expect(ratio(h.current())).toBeCloseTo(start, 6);
    release();
  });

  it.each(KINDS)('keeps the ratio of a %s from an edge', (_, make) => {
    syncFrames();
    const el = make();
    const start = ratio(el as never);
    const h = harness(el);
    h.press('resize-s');
    move(7, 60, true);
    expect(ratio(h.current())).toBeCloseTo(start, 6);
    release();
  });
});

describe('Shift resize, every tab kind and editor mode', () => {
  it.each([
    ['a diagram tab', 'diagram', false],
    ['a tab in Draw mode', 'diagram', true],
    ['an event-storming board', 'event-storming', false],
  ] as const)('keeps the ratio on %s', (_, kind, drawMode) => {
    syncFrames();
    const el = { ...createShape('square', 0, 0), width: 200, height: 100 };
    const h = harness(el, kind, drawMode);
    h.press('resize-ne');
    move(10, -80, true);
    expect(ratio(h.current())).toBeCloseTo(2, 6);
    release();
  });
});

describe('Shift pressed or released mid-drag', () => {
  it('takes effect on the next pointer move, without letting go', () => {
    syncFrames();
    const el = { ...createShape('square', 0, 0), width: 200, height: 100 };
    const h = harness(el);
    h.press('resize-se');
    move(100, 10, false);
    expect(h.current()).toMatchObject({ width: 300, height: 110 });
    move(100, 10, true);
    expect(h.current()).toMatchObject({ width: 300, height: 150 });
    move(100, 10, false);
    expect(h.current()).toMatchObject({ width: 300, height: 110 });
    release();
  });
});
