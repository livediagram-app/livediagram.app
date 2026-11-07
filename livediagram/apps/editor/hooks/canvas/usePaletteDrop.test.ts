// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import type { DragEvent as ReactDragEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type React from 'react';
import { LIBRARY_SHAPE_DND_MIME } from '@/lib/shape-library-dnd';
import { startCarry } from '@/lib/palette-carry';
import { getPaletteDragSnap, setPaletteDragSnap } from '@/lib/palette-drag-preview';
import { usePaletteDrop } from './usePaletteDrop';

// A file dropped on the canvas (docs/specs/020-import-export/excalidraw-import-export.md "Paste"):
// handed over with the canvas point it was released at; a photo on an event-storming board still
// goes to the wall reader first.

function setup(deps: { onDropFile?: boolean; onDropPhoto?: boolean } = {}) {
  const wrapper = document.createElement('div');
  wrapper.getBoundingClientRect = () => ({ left: 100, top: 50 }) as DOMRect;
  const onDropFile = vi.fn();
  const onDropPhoto = vi.fn();
  const { result } = renderHook(() =>
    usePaletteDrop({
      viewportZoom: 2,
      wrapperRef: { current: wrapper },
      ...(deps.onDropFile === false ? {} : { onDropFile }),
      ...(deps.onDropPhoto ? { onDropPhoto } : {}),
    }),
  );
  return { ...result.current, onDropFile, onDropPhoto };
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
    const file = new File(['{}'], 'board.excalidraw');
    const event = dragEvent([file]);
    h.onDrop(event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(h.onDropFile).toHaveBeenCalledWith(file, { x: 100, y: 100 });
  });

  it('accepts a file drag, so the cursor says it will land', () => {
    const h = setup();
    const event = dragEvent([new File(['{}'], 'board.excalidraw')]);
    h.onDragOver(event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.dataTransfer.dropEffect).toBe('copy');
  });

  it('leaves files alone where nothing takes them', () => {
    const h = setup({ onDropFile: false });
    const event = dragEvent([new File(['{}'], 'board.excalidraw')]);
    h.onDragOver(event);
    h.onDrop(event);
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it('still reads a photo on an event-storming board first', () => {
    const h = setup({ onDropPhoto: true });
    const photo = new File(['x'], 'wall.jpg', { type: 'image/jpeg' });
    h.onDrop(dragEvent([photo]));
    expect(h.onDropPhoto).toHaveBeenCalledWith(photo);
    expect(h.onDropFile).not.toHaveBeenCalled();
  });
});

// A shape from My shapes (docs/specs/013-workspace/blueprints/shape-libraries.md "Behaviour and
// state" 6): its library and item, with the canvas point.
describe('dropping a library shape on the canvas', () => {
  function libraryDrag(data: string) {
    return {
      target: document.createElement('div'),
      clientX: 300,
      clientY: 250,
      preventDefault: vi.fn(),
      dataTransfer: {
        files: [],
        types: [LIBRARY_SHAPE_DND_MIME],
        getData: (type: string) => (type === LIBRARY_SHAPE_DND_MIME ? data : ''),
        dropEffect: 'none',
      },
    } as unknown as ReactDragEvent<HTMLElement>;
  }
  function setupLibrary() {
    const wrapper = document.createElement('div');
    wrapper.getBoundingClientRect = () => ({ left: 100, top: 50 }) as DOMRect;
    const onDropLibraryShape = vi.fn();
    const { result } = renderHook(() =>
      usePaletteDrop({ viewportZoom: 2, wrapperRef: { current: wrapper }, onDropLibraryShape }),
    );
    return { ...result.current, onDropLibraryShape };
  }

  it('hands the shape over with its canvas point, and accepts the drag', () => {
    const h = setupLibrary();
    const over = libraryDrag('');
    h.onDragOver(over);
    expect(over.dataTransfer.dropEffect).toBe('copy');
    const drop = libraryDrag(JSON.stringify({ libraryId: 'l1', itemId: 'i1' }));
    h.onDrop(drop);
    expect(drop.preventDefault).toHaveBeenCalled();
    expect(h.onDropLibraryShape).toHaveBeenCalledWith(
      { libraryId: 'l1', itemId: 'i1' },
      { x: 100, y: 100 },
    );
  });

  it('ignores a payload that is not a library shape', () => {
    const h = setupLibrary();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    h.onDrop(libraryDrag('{"nope":1}'));
    expect(h.onDropLibraryShape).not.toHaveBeenCalled();
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
        types: ['application/x-livediagram-id'],
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

describe('a tile carried by the pointer (lib/palette-carry.ts)', () => {
  function carryOnto(target: HTMLElement) {
    startCarry(
      {
        pointerType: 'mouse',
        button: 0,
        pointerId: 1,
        clientX: 0,
        clientY: 0,
      } as React.PointerEvent,
      'sofa',
      'cosy',
    );
    for (const type of ['pointermove', 'pointerup']) {
      const e = new MouseEvent(type, { bubbles: true, clientX: 300, clientY: 250 });
      Object.defineProperty(e, 'pointerId', { value: 1 });
      target.dispatchEvent(e);
    }
  }

  function mounted() {
    const main = document.createElement('main');
    const wrapper = document.createElement('div');
    wrapper.getBoundingClientRect = () => ({ left: 100, top: 50 }) as DOMRect;
    main.appendChild(wrapper);
    document.body.appendChild(main);
    const onDropPalette = vi.fn();
    const view = renderHook(() =>
      usePaletteDrop({ viewportZoom: 2, wrapperRef: { current: wrapper }, onDropPalette }),
    );
    return { wrapper, onDropPalette, view };
  }

  it('lands where the drop would, snapped as the drag latched', () => {
    const { wrapper, onDropPalette, view } = mounted();
    setPaletteDragSnap({ dx: 5, dy: -5 });
    carryOnto(wrapper);
    expect(onDropPalette).toHaveBeenCalledWith('sofa', 105, 95, { choice: 'cosy' });
    expect(getPaletteDragSnap()).toBeNull();
    view.unmount();
    document.body.innerHTML = '';
  });

  it('lands only on the canvas it was released over', () => {
    const { onDropPalette, view } = mounted();
    const other = document.createElement('main');
    document.body.appendChild(other);
    carryOnto(other);
    expect(onDropPalette).not.toHaveBeenCalled();
    view.unmount();
    document.body.innerHTML = '';
  });
});
