// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import type { DragEvent as ReactDragEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { usePaletteDrop } from './usePaletteDrop';

// A file dropped on the canvas (docs/specs/008-canvas/canvas-and-palette.md):
// handed over with the canvas point it was released at.

function setup(deps: { onDropFile?: boolean } = {}) {
  const wrapper = document.createElement('div');
  wrapper.getBoundingClientRect = () => ({ left: 100, top: 50 }) as DOMRect;
  const onDropFile = vi.fn();
  const { result } = renderHook(() =>
    usePaletteDrop({
      viewportZoom: 2,
      wrapperRef: { current: wrapper },
      ...(deps.onDropFile === false ? {} : { onDropFile }),
    }),
  );
  return { ...result.current, onDropFile };
}

function dragEvent(files: File[]) {
  const target = document.createElement('div');
  return {
    target,
    clientX: 300,
    clientY: 250,
    preventDefault: vi.fn(),
    dataTransfer: {
      files,
      types: files.length > 0 ? ['Files'] : [],
      getData: () => '',
      dropEffect: 'none',
    },
  } as unknown as ReactDragEvent<HTMLElement>;
}

describe('dropping a file on the canvas', () => {
  it('hands the file over with its canvas point', () => {
    const h = setup();
    const file = new File(['{}'], 'board.png');
    const event = dragEvent([file]);
    h.onDrop(event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(h.onDropFile).toHaveBeenCalledWith(file, { x: 100, y: 100 });
  });

  it('accepts a file drag, so the cursor says it will land', () => {
    const h = setup();
    const event = dragEvent([new File(['{}'], 'board.png')]);
    h.onDragOver(event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.dataTransfer.dropEffect).toBe('copy');
  });

  it('leaves files alone where nothing takes them', () => {
    const h = setup({ onDropFile: false });
    const event = dragEvent([new File(['{}'], 'board.png')]);
    h.onDragOver(event);
    h.onDrop(event);
    expect(event.preventDefault).not.toHaveBeenCalled();
  });
});

describe('a drag a panel inside the canvas already took', () => {
  // docs/specs/013-workspace/folders.md "Drag-and-drop": a design dragged onto a folder in the Explorer panel,
  // which floats over the canvas. The folder accepts it first; the canvas must not cancel that.
  function panelDrag() {
    const panel = document.createElement('div');
    panel.setAttribute('data-floating-panel', '');
    const target = document.createElement('div');
    panel.appendChild(target);
    return {
      target,
      clientX: 0,
      clientY: 0,
      defaultPrevented: true,
      preventDefault: vi.fn(),
      dataTransfer: {
        files: [],
        types: ['application/x-livedesign-id'],
        getData: () => 'doc-1',
        dropEffect: 'move',
      },
    } as unknown as ReactDragEvent<HTMLElement>;
  }

  it('keeps the move the folder chose rather than showing no-drop', () => {
    const h = setup();
    const event = panelDrag();
    h.onDragOver(event);
    expect(event.dataTransfer.dropEffect).toBe('move');
  });

  it('adds nothing to the canvas on the drop', () => {
    const h = setup();
    h.onDrop(panelDrag());
    expect(h.onDropFile).not.toHaveBeenCalled();
  });
});
