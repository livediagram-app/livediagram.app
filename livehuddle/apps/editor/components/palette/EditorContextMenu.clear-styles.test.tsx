// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createText, type Element } from '@livehuddle/document';
import { publishClearStyles } from '@liveworkspace/workbench/lib/clear-styles-store';
import { EditorContextMenu } from './EditorContextMenu';
import type { EditorContextMenuProps } from './EditorContextMenu.types';

// docs/specs/008-canvas/element-menu-quick-bar.md (Work Tracker 739): livehuddle's element menu has no quick bar band
// above its categories. Clear Styles is a row of the appearance group, right under Style, while the element takes a
// quick style.
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});
afterEach(() => {
  cleanup();
  publishClearStyles(null);
});

function open(target: Element) {
  const onClose = vi.fn();
  const given: Record<string, unknown> = {
    menu: { mode: 'element', elementId: target.id, x: 10, y: 10 },
    elements: [target],
    layers: [],
    theme: undefined,
    onClose,
  };
  const props = new Proxy(given, {
    get: (t, k: string) => (k in t ? t[k] : vi.fn()),
    has: () => true,
  }) as unknown as EditorContextMenuProps;
  const Host = () => EditorContextMenu(props);
  render(<Host />);
  return { onClose };
}

const text = (): Element => ({ ...createText(0, 0), id: 'sq', label: 'Agenda' });
const rows = () => screen.getAllByRole('button').map((b) => b.textContent?.trim() ?? '');

describe('the element menu’s Clear Styles', () => {
  it('draws no quick bar band, and opens on the Arrange category', () => {
    open(text());
    act(() => publishClearStyles({ targetIds: new Set(['sq']), clear: vi.fn() }));
    expect(document.querySelector('[data-element-quick-bar]')).toBeNull();
    expect(screen.queryByRole('toolbar', { name: 'Quick actions' })).toBeNull();
    expect(rows()[0]).toBe('Arrange');
  });

  it('sits directly under Style, and clears in one press', () => {
    const clear = vi.fn();
    const { onClose } = open(text());
    act(() => publishClearStyles({ targetIds: new Set(['sq']), clear }));
    const order = rows();
    expect(order[order.indexOf('Style') + 1]).toBe('Clear Styles');
    fireEvent.click(screen.getByRole('button', { name: 'Clear Styles' }));
    expect(clear).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('leaves no row on an element the quick style is not on', () => {
    open(text());
    act(() => publishClearStyles({ targetIds: new Set(['other']), clear: vi.fn() }));
    expect(screen.queryByRole('button', { name: 'Clear Styles' })).toBeNull();
    expect(rows()).toContain('Style');
  });
});
