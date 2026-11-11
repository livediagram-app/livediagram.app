// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createShape, type Element } from '@livehuddle/document';
import { EditorContextMenu } from './EditorContextMenu';
import type { EditorContextMenuProps } from './EditorContextMenu.types';

// docs/specs/002-project-scope/not-in-livehuddle.md "Retired elements": a retired element keeps its stored look and
// kind and has no settings or menu section of its own. A deleted shape kind (a stored Q&A Board) is still a `shape`,
// so its menus offered Shape, Opacity and Style, whose every press it ignored.
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});
afterEach(cleanup);

function open(menu: Record<string, unknown>, elements: Element[]) {
  const given: Record<string, unknown> = {
    menu,
    elements,
    selectionElements: elements,
    layers: [],
    theme: undefined,
  };
  const props = new Proxy(given, {
    get: (t, k: string) => (k in t ? t[k] : vi.fn()),
    has: () => true,
  }) as unknown as EditorContextMenuProps;
  const Host = () => EditorContextMenu(props);
  render(<Host />);
}

const button = (name: string) =>
  screen.queryAllByRole('button').some((b) => b.textContent?.trim() === name);

const qaBoard = {
  id: 'q',
  type: 'shape',
  shape: 'qa-board',
  x: 0,
  y: 0,
  width: 220,
  height: 150,
  label: 'Questions',
} as unknown as Element;
const square = { ...createShape('focus-button', 0, 0), id: 's', label: 'Box' } as Element;
const image = {
  id: 'i',
  type: 'image',
  x: 300,
  y: 0,
  width: 100,
  height: 80,
  imageId: null,
} as Element;

describe('a retired shape’s element menu', () => {
  it('offers no Shape, Opacity or Style', () => {
    open({ mode: 'element', elementId: 'q', x: 10, y: 10 }, [qaBoard]);
    expect(button('Arrange')).toBe(true);
    expect(button('Shape')).toBe(false);
    expect(button('Style')).toBe(false);
    expect(screen.queryByLabelText('Opacity')).toBeNull();
  });

  it('still offers Style on a shape livehuddle has (the Shape section left with the diagram shapes)', () => {
    open({ mode: 'element', elementId: 's', x: 10, y: 10 }, [square]);
    expect(button('Shape')).toBe(false);
    expect(button('Style')).toBe(true);
  });
});

describe('a selection holding a retired shape', () => {
  it('offers no Shape to morph it into', () => {
    open({ mode: 'multi', x: 10, y: 10 }, [image, qaBoard]);
    expect(button('Arrange')).toBe(true);
    expect(button('Shape')).toBe(false);
  });

  it('offers no Style when only retired members are selected', () => {
    open({ mode: 'multi', x: 10, y: 10 }, [qaBoard, { ...qaBoard, id: 'q2' }]);
    expect(button('Style')).toBe(false);
  });
});
