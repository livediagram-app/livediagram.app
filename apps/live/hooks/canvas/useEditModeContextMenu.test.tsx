// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Element } from '@livediagram/document';
import { useEditModeContextMenu } from './useEditModeContextMenu';

// The auto-open-menu-on-edit behaviour (docs/specs/008-canvas/canvas-and-palette.md): entering text-edit mode on
// a boxed element opens the element menu beside it. Stickies opt out — a
// sticky's double-click means "type a note", and a menu popping open beside
// every note is noise (the user asked for exactly this); right-click still
// opens the menu deliberately. The DOM-measuring path needs a rendered
// element node, so these tests pin the EARLY exits (the sticky opt-out and
// the read-only guard) — the paths that decide whether a menu opens at all.
describe('useEditModeContextMenu', () => {
  const sticky: Element = {
    id: 's1',
    type: 'sticky',
    x: 0,
    y: 0,
    width: 200,
    height: 200,
  } as Element;
  const shape: Element = {
    id: 'q1',
    type: 'shape',
    shape: 'square',
    x: 0,
    y: 0,
    width: 120,
    height: 120,
  } as Element;

  it('never auto-opens the menu when the edited element is a sticky', () => {
    const setContextMenu = vi.fn();
    renderHook(() =>
      useEditModeContextMenu({
        editingId: 's1',
        elements: [sticky, shape],
        isReadOnly: false,
        setContextMenu,
      }),
    );
    expect(setContextMenu).not.toHaveBeenCalled();
  });

  it('still tries to open for a shape (falls through to the measuring path)', () => {
    const setContextMenu = vi.fn();
    // No DOM node exists for q1 in this test, so the hook exits at the
    // querySelector guard WITHOUT calling the setter — the point here is
    // that the sticky exit fires BEFORE measurement while shapes proceed.
    // Give the shape a node and the setter is called.
    const node = document.createElement('div');
    node.setAttribute('data-element-id', 'q1');
    const layer = document.createElement('div');
    Object.defineProperty(node, 'offsetParent', { get: () => layer });
    Object.defineProperty(layer, 'offsetWidth', { get: () => 1000 });
    layer.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 1000, height: 800, right: 1000, bottom: 800 }) as DOMRect;
    layer.appendChild(node);
    document.body.appendChild(layer);
    renderHook(() =>
      useEditModeContextMenu({
        editingId: 'q1',
        elements: [sticky, shape],
        isReadOnly: false,
        setContextMenu,
      }),
    );
    expect(setContextMenu).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'element', elementId: 'q1' }),
    );
    document.body.removeChild(layer);
  });
});

describe('a path in its edit mode (docs/specs/023-whiteboard/path-tool.md "Editing")', () => {
  it('never opens the element menu: its edit mode is its points, with its own toolbar', () => {
    const path = {
      id: 'p1',
      type: 'path',
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      nodes: [],
      closed: false,
    } as unknown as Element;
    const setContextMenu = vi.fn();
    const measure = vi.spyOn(document, 'querySelector');
    renderHook(() =>
      useEditModeContextMenu({
        editingId: 'p1',
        elements: [path],
        isReadOnly: false,
        setContextMenu,
      }),
    );
    expect(measure).not.toHaveBeenCalledWith('[data-element-id="p1"]');
    measure.mockRestore();
  });
});

// docs/specs/023-whiteboard/whiteboard.md "Text boxes": a whiteboard text box starts caret-sized and
// grows with the words, so a menu opened at its corner would sit on the line being typed.
describe('a whiteboard text box being typed into', () => {
  const text = { id: 't1', type: 'text', x: 0, y: 0, width: 8, height: 22 } as Element;

  it('never opens the element menu beside it', () => {
    const setContextMenu = vi.fn();
    const measure = vi.spyOn(document, 'querySelector');
    renderHook(() =>
      useEditModeContextMenu({
        editingId: 't1',
        elements: [text],
        isReadOnly: false,
        whiteboard: true,
        setContextMenu,
      }),
    );
    expect(measure).not.toHaveBeenCalledWith('[data-element-id="t1"]');
    measure.mockRestore();
  });

  it('still opens it for a text box on a diagram tab', () => {
    const measure = vi.spyOn(document, 'querySelector');
    renderHook(() =>
      useEditModeContextMenu({
        editingId: 't1',
        elements: [text],
        isReadOnly: false,
        whiteboard: false,
        setContextMenu: vi.fn(),
      }),
    );
    expect(measure).toHaveBeenCalledWith('[data-element-id="t1"]');
    measure.mockRestore();
  });
});
