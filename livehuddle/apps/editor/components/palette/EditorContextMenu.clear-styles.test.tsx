// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createText, type Element } from '@livehuddle/document';
import { publishClearStyles } from '@liveworkspace/workbench/lib/clear-styles-store';
import { EditorContextMenu } from './EditorContextMenu';
import type { EditorContextMenuProps } from './EditorContextMenu.types';

// docs/specs/008-canvas/element-menu-quick-bar.md (Work Tracker 739): livehuddle's element menu has no quick bar band
// above its categories. Clear Styles is a row of the appearance group, right under Appearance, while the element takes a
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
  it('draws Clear Styles in a quick bar above the categories (the owner, 2026-11-18), the menu opening on Arrange', () => {
    open(text());
    act(() => publishClearStyles({ targetIds: new Set(['sq']), clear: vi.fn() }));
    const bar = document.querySelector('[data-element-quick-bar]');
    expect(bar).not.toBeNull();
    expect(bar!.querySelector('button[aria-label="Clear Styles"]')).not.toBeNull();
    // The bar's eraser is a glyph; the first named row is Arrange.
    expect(rows().filter(Boolean)[0]).toBe('Arrange');
    expect(rows()).not.toContain('Clear Styles');
  });

  it('clears in one press from the bar, and closes the menu', () => {
    const clear = vi.fn();
    const { onClose } = open(text());
    act(() => publishClearStyles({ targetIds: new Set(['sq']), clear }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear Styles' }));
    expect(clear).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('leaves no row on an element the quick style is not on', () => {
    open(text());
    act(() => publishClearStyles({ targetIds: new Set(['other']), clear: vi.fn() }));
    expect(screen.queryByRole('button', { name: 'Clear Styles' })).toBeNull();
    expect(document.querySelector('[data-element-quick-bar]')).toBeNull();
    expect(rows()).toContain('Appearance');
  });
});
