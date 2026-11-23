// @vitest-environment jsdom

// A pointer note's tip handle where the setter previews the drag (livediagram's docs/specs/009-elements/pointer-note.md).

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ShapeElement } from '@liveworkspace/element-model/element';
import { createShape } from '@liveworkspace/element-model/testing/elements';
import { PointerNoteOverlay } from './PointerNoteOverlay';

afterEach(cleanup);

type Note = ShapeElement & { animation?: string };

const note = (over: Partial<Note> = {}) =>
  ({
    ...createShape('pointer-note', 0, 0),
    id: 'n',
    x: 100,
    y: 50,
    width: 180,
    height: 64,
    pointerTip: { x: -24, y: 120 },
    ...over,
  }) as Note;

function show(element: Note, editable = true) {
  const onSetTip = vi.fn();
  const { container } = render(
    <PointerNoteOverlay
      element={element}
      stroke="#d97706"
      editable={editable}
      onSetTip={onSetTip}
      previewsTip
    />,
  );
  return { onSetTip, container };
}

describe('PointerNoteOverlay', () => {
  it('draws the leader from the box edge to the tip, and the tip dot', () => {
    const { container } = show(note(), false);
    const line = container.querySelector('line')!;
    expect([line.getAttribute('x1'), line.getAttribute('y1')]).toEqual(['0', '64']);
    expect([line.getAttribute('x2'), line.getAttribute('y2')]).toEqual(['-24', '120']);
    expect(container.querySelector('[data-pointer-tip]')!.getAttribute('cx')).toBe('-24');
    expect(screen.queryByRole('button', { name: 'Move pointer tip' })).toBeNull();
  });

  it('drags the tip and commits once, in canvas coordinates, on release', () => {
    const { onSetTip, container } = show(note());
    const handle = screen.getByRole('button', { name: 'Move pointer tip' });
    handle.setPointerCapture = () => {};
    fireEvent.pointerDown(handle, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 40, clientY: 30, pointerId: 1 });
    expect(container.querySelector('[data-pointer-tip]')!.getAttribute('cx')).toBe('6');
    // While it moves the host only previews (its anchors show, the tip may snap); nothing is stored.
    expect(onSetTip.mock.calls.map((c: unknown[]) => c[2] as string)).toEqual(['preview']);
    fireEvent.pointerUp(handle, { clientX: 40, clientY: 30, pointerId: 1 });
    const stored = onSetTip.mock.calls.filter((c) => c[2] !== 'preview' && c[2] !== 'cancel');
    expect(stored).toEqual([['n', { x: 100 + 6, y: 50 + 140 }, ...stored[0]!.slice(2)]]);
  });

  it('puts the tip back and stores nothing when the browser cancels the drag', () => {
    const { onSetTip, container } = show(note());
    const handle = screen.getByRole('button', { name: 'Move pointer tip' });
    handle.setPointerCapture = () => {};
    fireEvent.pointerDown(handle, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 40, clientY: 30, pointerId: 1 });
    fireEvent.pointerCancel(handle, { pointerId: 1 });
    expect(container.querySelector('[data-pointer-tip]')!.getAttribute('cx')).toBe('-24');
    // A later move without a press drags nothing.
    fireEvent.pointerMove(handle, { clientX: 80, clientY: 80, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientX: 80, clientY: 80, pointerId: 1 });
    expect(container.querySelector('[data-pointer-tip]')!.getAttribute('cx')).toBe('-24');
    // Only the preview and its cancel reached the host: nothing was stored.
    expect(onSetTip.mock.calls.map((c: unknown[]) => c[2] as string)).toEqual([
      'preview',
      'cancel',
    ]);
  });

  it('nudges the tip with the arrow keys, ten at a time with Shift', () => {
    const { onSetTip } = show(note());
    const handle = screen.getByRole('button', { name: 'Move pointer tip' });
    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    expect(onSetTip).toHaveBeenLastCalledWith('n', { x: 100 - 23, y: 50 + 120 });
    fireEvent.keyDown(handle, { key: 'ArrowDown', shiftKey: true });
    expect(onSetTip).toHaveBeenLastCalledWith('n', { x: 100 - 24, y: 50 + 130 });
  });

  it('pulses the tip when the note has the Pulse animation', () => {
    const { container } = show(note({ animation: 'pulse' }), false);
    expect(container.querySelector('.lvd-pointer-tip-pulse')).not.toBeNull();
  });
});
