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
import { applyOverlay, localPreview, resetDragPreviewForTests } from '@/lib/drag-preview';
import { useEditorDrag } from './useEditorDrag';
import type { EditorDragDeps } from './useEditorDrag.types';

// Stands in for the DOM text measure in Draw mode: 10 px a character at 14 px, scaled with the
// text, one line of 1.25 leading.
vi.mock('@/components/canvas/text-hug-measure', () => ({
  measureDrawnText: () => (el: { label?: string; textScale?: number }) => () => {
    const px = 14 * (el.textScale ?? 1);
    return { width: ((el.label ?? '').length * 10 * px) / 14, height: px * 1.25 };
  },
}));

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

function harness(element: Element, kind: TabKind = 'diagram') {
  let elements: Element[] = [element];
  const deps = {
    get activeTab() {
      return { id: 't', name: 'Tab', kind, elements } as Tab;
    },
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
  // The board as drawn: the document with the gesture's preview over it (docs/specs/008-canvas/drag-preview.md).
  const shown = () => {
    const o = localPreview();
    return o ? applyOverlay(elements, o) : elements;
  };
  const view = renderHook(() => useEditorDrag(deps));
  const current = () => {
    const el = shown().find((e) => e.id === element.id);
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
  resetDragPreviewForTests();
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

describe('Shift resize, every tab kind', () => {
  it.each(['diagram', 'event-storming'] as const)('keeps the ratio on a %s tab', (kind) => {
    syncFrames();
    const el = { ...createShape('square', 0, 0), width: 200, height: 100 };
    const h = harness(el, kind);
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

// docs/specs/023-draw-mode/draw-mode.md "Text boxes": Shift keeps a hugging text box's
// ratio by scaling its text with the box; the height hugs the scaled text.
// Keyed on the box's sizing, never the editor mode (docs/specs/007-editor/editor-modes.md "A text
// box's sizing"); the drag machine has no mode at all.
describe('Shift resize of a hugging text box', () => {
  const hello = () => ({
    ...createText(0, 0),
    label: 'Hello',
    sizing: 'fit' as const,
    textSize: 'sm' as const,
    width: 58,
    height: 22,
  });
  // The text's own block (the box less its 4 px / 2 px hug padding).
  const textRatio = (el: { width: number; height: number }) => (el.width - 8) / (el.height - 4);

  it.each(['resize-se', 'resize-ne', 'resize-e'] as const)(
    'keeps the text block’s ratio from %s, scaling the text',
    (mode) => {
      syncFrames();
      const h = harness(hello());
      const before = textRatio(h.current());
      h.press(mode);
      move(58, mode === 'resize-ne' ? -10 : 10, true);
      const after = h.current() as ReturnType<typeof hello> & { textScale?: number };
      expect(after.width).toBe(116);
      expect(after.textScale).toBeCloseTo(108 / 50, 6);
      // The height is whole px, rounded up, so the ratio holds to within a pixel of height.
      expect(Math.abs(textRatio(after) - before)).toBeLessThan(before / (after.height - 4));
      release();
    },
  );

  it('keeps a fixed text box’s own ratio, its text unscaled', () => {
    syncFrames();
    const h = harness({ ...hello(), sizing: undefined });
    h.press('resize-se');
    move(58, 10, true);
    const after = h.current() as ReturnType<typeof hello> & { textScale?: number };
    expect(after.width / after.height).toBeCloseTo(58 / 22, 6);
    expect(after.textScale).toBeUndefined();
    release();
  });
});
