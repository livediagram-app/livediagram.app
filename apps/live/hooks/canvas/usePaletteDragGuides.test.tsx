// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { Element } from '@livediagram/diagram';
import {
  getInsertionSlot,
  getPaletteDragSnap,
  setInsertionSlot,
  setPaletteDragPreview,
  setPaletteDragSnap,
} from '@/lib/palette-drag-preview';
import { usePaletteDragGuides } from './usePaletteDragGuides';

// A row of three 200x200 notes with 72 gaps: 0..200, 272..472, 544..744.
function note(id: string, x: number): Element {
  return { id, type: 'sticky', x, y: 0, width: 200, height: 200 } as Element;
}
const ROW = [note('a', 0), note('b', 272), note('c', 544)];

// The hook converts client coords through the wrapper rect; a 1:1 rect at the
// origin makes canvas coords and client coords the same number.
function wrapper() {
  const el = document.createElement('div');
  el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 1000 }) as DOMRect;
  const main = document.createElement('main');
  main.appendChild(el);
  document.body.appendChild(main);
  return { current: el };
}

function dragOver(target: HTMLElement, clientX: number, clientY: number, altKey = false) {
  const event = new Event('dragover', { bubbles: true }) as DragEvent & {
    clientX: number;
    clientY: number;
  };
  Object.defineProperty(event, 'clientX', { value: clientX });
  Object.defineProperty(event, 'clientY', { value: clientY });
  Object.defineProperty(event, 'altKey', { value: altKey });
  act(() => {
    target.dispatchEvent(event);
  });
}

// The gesture as the author performs it: Alt held while the drag passes over
// the gap. Every slot-opening assertion below goes through this — without the
// modifier there is no slot to assert.
function altDragOver(target: HTMLElement, clientX: number, clientY: number) {
  dragOver(target, clientX, clientY, true);
}

function render(opts: { esBoard: boolean; elements?: Element[]; zoom?: number }) {
  const wrapperRef = wrapper();
  setPaletteDragPreview({ kind: 'square', width: 200, height: 200 });
  const view = renderHook(() =>
    usePaletteDragGuides({
      elements: opts.elements ?? ROW,
      viewportZoom: opts.zoom ?? 1,
      wrapperRef,
      insertGate: {
        esBoard: opts.esBoard,
        readOnly: false,
        tabLocked: false,
        createBlocked: false,
      },
      inertIds: new Set<string>(),
    }),
  );
  return { ...view, wrapperRef };
}

afterEach(() => {
  setPaletteDragPreview(null);
  setInsertionSlot(null);
  setPaletteDragSnap(null);
  document.body.innerHTML = '';
});

describe('usePaletteDragGuides — insert between (spec/139)', () => {
  it('offers a slot while Alt is held over a gap on an event-storming board', () => {
    const { wrapperRef, result } = render({ esBoard: true });
    altDragOver(wrapperRef.current, 236, 100);
    const slot = getInsertionSlot();
    expect(slot?.leftId).toBe('a');
    expect(slot?.rightId).toBe('b');
    // The marker is an alignment guide at the insertion point, drawn in the
    // overlay's existing visual language.
    expect(result.current.guides).toEqual([
      { axis: 'x', position: slot!.atX, start: slot!.spanTop, end: slot!.spanBottom },
    ]);
  });

  it('puts the ghost in the slot, so the preview and the drop agree', () => {
    const { wrapperRef } = render({ esBoard: true });
    altDragOver(wrapperRef.current, 236, 100);
    // Ghost centre = slot left edge + half the incoming note; the snap is the
    // offset from the cursor to that centre.
    expect(getPaletteDragSnap()).toEqual({ dx: 372 - 236, dy: 100 - 100 });
  });

  it('yields the alignment snap while a slot is open — one placement rule at a time', () => {
    const { wrapperRef, result } = render({ esBoard: true });
    // 236 is the gap's midpoint; the alignment snap would otherwise latch the
    // dragged footprint onto its neighbours' edges and fight the slot.
    altDragOver(wrapperRef.current, 236, 100);
    expect(result.current.distGuides).toEqual([]);
    expect(result.current.guides).toHaveLength(1);
    expect(getPaletteDragSnap()?.dx).toBe(136);
  });

  // THE regression guard: this is what the whole Alt gesture exists to
  // protect. An author dragging a note near a row must not have the board
  // rearrange under them.
  it('offers nothing without Alt, however inviting the gap', () => {
    const { wrapperRef, result } = render({ esBoard: true });
    dragOver(wrapperRef.current, 236, 100);
    expect(getInsertionSlot()).toBeNull();
    // ...and the drag resolves exactly the alignment snap it always did.
    expect(result.current.guides.length).toBeGreaterThan(0);
    expect(getPaletteDragSnap()?.dx).not.toBe(136);
  });

  it('opens the slot the moment Alt goes down mid-drag', () => {
    const { wrapperRef } = render({ esBoard: true });
    dragOver(wrapperRef.current, 236, 100);
    expect(getInsertionSlot()).toBeNull();
    altDragOver(wrapperRef.current, 236, 100);
    expect(getInsertionSlot()?.rightId).toBe('b');
  });

  it('unwinds the moment Alt comes up, handing placement back to the snap', () => {
    const { wrapperRef, result } = render({ esBoard: true });
    altDragOver(wrapperRef.current, 236, 100);
    expect(getInsertionSlot()).not.toBeNull();
    dragOver(wrapperRef.current, 236, 100);
    expect(getInsertionSlot()).toBeNull();
    // The ordinary alignment snap is live again for the rest of the drag.
    expect(result.current.guides.length).toBeGreaterThan(0);
  });

  it('never offers a slot on an ordinary board, Alt or no Alt', () => {
    const { wrapperRef, result } = render({ esBoard: false });
    altDragOver(wrapperRef.current, 236, 100);
    expect(getInsertionSlot()).toBeNull();
    // ...and the ordinary alignment behaviour is untouched.
    expect(result.current.guides.length).toBeGreaterThan(0);
  });

  it('closes the slot when the drag moves off the gap', () => {
    const { wrapperRef } = render({ esBoard: true });
    altDragOver(wrapperRef.current, 236, 100);
    expect(getInsertionSlot()).not.toBeNull();
    altDragOver(wrapperRef.current, 236, 900);
    expect(getInsertionSlot()).toBeNull();
  });

  it('closes the slot when the drag goes back over a floating panel', () => {
    const { wrapperRef } = render({ esBoard: true });
    altDragOver(wrapperRef.current, 236, 100);
    const panel = document.createElement('div');
    panel.setAttribute('data-floating-panel', '');
    document.body.querySelector('main')!.appendChild(panel);
    altDragOver(panel, 236, 100);
    expect(getInsertionSlot()).toBeNull();
    expect(getPaletteDragSnap()).toBeNull();
  });

  it('closes the slot when the drag leaves the window', () => {
    const { wrapperRef } = render({ esBoard: true });
    altDragOver(wrapperRef.current, 236, 100);
    act(() => {
      document.dispatchEvent(new Event('dragleave', { bubbles: true }));
    });
    expect(getInsertionSlot()).toBeNull();
  });

  it('closes the slot on Escape, leaving the board exactly as it was', () => {
    const { wrapperRef } = render({ esBoard: true });
    altDragOver(wrapperRef.current, 236, 100);
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(getInsertionSlot()).toBeNull();
    expect(getPaletteDragSnap()).toBeNull();
  });

  it('clears the slot when the drag ends', () => {
    const { wrapperRef, unmount } = render({ esBoard: true });
    altDragOver(wrapperRef.current, 236, 100);
    unmount();
    expect(getInsertionSlot()).toBeNull();
  });

  // The cursor→canvas inversion through the transformed wrapper is the trap:
  // resolve the gap in SCREEN pixels and the slot lands somewhere else at any
  // zoom but 100%.
  it.each([0.25, 4])('resolves the same gap at %sx zoom', (zoom) => {
    const { wrapperRef } = render({ esBoard: true, zoom });
    // Canvas x 236 in the gap, expressed in client pixels at this zoom.
    altDragOver(wrapperRef.current, 236 * zoom, 100 * zoom);
    const slot = getInsertionSlot();
    expect(slot?.atX).toBe(272);
    expect(slot?.rightId).toBe('b');
    // The snap is canvas units — the ghost multiplies it by the zoom itself.
    expect(getPaletteDragSnap()).toEqual({ dx: 136, dy: 0 });
  });

  it('does not inherit the previous drag\u2019s slot', () => {
    const first = render({ esBoard: true });
    altDragOver(first.wrapperRef.current, 236, 100);
    expect(getInsertionSlot()).not.toBeNull();
    first.unmount();
    const second = render({ esBoard: true });
    expect(getInsertionSlot()).toBeNull();
    // A fresh drag that never hovers a gap keeps it that way.
    altDragOver(second.wrapperRef.current, 100, 100);
    expect(getInsertionSlot()).toBeNull();
  });
});
