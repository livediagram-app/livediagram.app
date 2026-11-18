// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import type { DragEvent as ReactDragEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { LIBRARY_ITEM_DND_MIME } from '@liveworkspace/workbench/lib/library/library-dnd';
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
  // docs/specs/013-workspace/folders.md "Drag-and-drop": a document dragged onto a folder in the Explorer panel,
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
        types: ['application/x-livedocuments-id'],
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

// A Library tile dropped on the canvas (liveworkspace/docs/specs/006-media/libraries.md "Placing: a click or a drag",
// Work Tracker 1128): its id handed over with the canvas point it was released at.
describe('dropping a Library item on the canvas', () => {
  const libraryDrag = (data: string) =>
    ({
      target: document.createElement('div'),
      clientX: 300,
      clientY: 250,
      preventDefault: vi.fn(),
      dataTransfer: {
        files: [],
        types: [LIBRARY_ITEM_DND_MIME],
        getData: (type: string) => (type === LIBRARY_ITEM_DND_MIME ? data : ''),
        dropEffect: 'none',
      },
    }) as unknown as ReactDragEvent<HTMLElement>;
  const hook = (onDropLibraryItem?: (id: string, at: { x: number; y: number }) => void) => {
    const wrapper = document.createElement('div');
    wrapper.getBoundingClientRect = () => ({ left: 100, top: 50 }) as DOMRect;
    return renderHook(() =>
      usePaletteDrop({
        viewportZoom: 2,
        wrapperRef: { current: wrapper },
        ...(onDropLibraryItem ? { onDropLibraryItem } : {}),
      }),
    ).result.current;
  };

  it('accepts the drag and hands the item over at its canvas point', () => {
    const onDropLibraryItem = vi.fn();
    const h = hook(onDropLibraryItem);
    const over = libraryDrag(JSON.stringify({ id: 'item_1' }));
    h.onDragOver(over);
    expect(over.dataTransfer.dropEffect).toBe('copy');
    const drop = libraryDrag(JSON.stringify({ id: 'item_1' }));
    h.onDrop(drop);
    expect(drop.preventDefault).toHaveBeenCalled();
    expect(onDropLibraryItem).toHaveBeenCalledWith('item_1', { x: 100, y: 100 });
  });

  it('ignores a malformed payload, and takes nothing where nothing can be placed', () => {
    const onDropLibraryItem = vi.fn();
    hook(onDropLibraryItem).onDrop(libraryDrag('not json'));
    expect(onDropLibraryItem).not.toHaveBeenCalled();
    const h = hook();
    const over = libraryDrag(JSON.stringify({ id: 'item_1' }));
    h.onDragOver(over);
    expect(over.preventDefault).not.toHaveBeenCalled();
  });
});
