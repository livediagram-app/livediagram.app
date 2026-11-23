// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createShape, type BoxedElement, type Element } from '@liveplanner/project';
import { EditorContextMenu } from './EditorContextMenu';
import type { EditorContextMenuProps } from './EditorContextMenu.types';
import { quickBarItems } from './ElementMenuQuickBar';

// docs/specs/026-plan/plan-mode.md "Nothing attached to Plan items": a Plan item's element menu offers no Assign
// Action, Add Comment, Add Link or Add Note (its menu has no Resources row), whoever opens it; any other element
// keeps them.
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});
afterEach(cleanup);

function open(target: Element) {
  const onOpenResources = vi.fn();
  const given: Record<string, unknown> = {
    menu: { mode: 'element', elementId: target.id, x: 10, y: 10 },
    elements: [target],
    layers: [],
    theme: undefined,
    onOpenResources,
  };
  // Every handler is a stub; only what the menu reads as data is given.
  const props = new Proxy(given, {
    get: (t, k: string) => (k in t ? t[k] : vi.fn()),
    has: () => true,
  }) as unknown as EditorContextMenuProps;
  // Called as the body of a host, so the menu reads its props through the proxy (a spread copies only own keys).
  const Host = () => EditorContextMenu(props);
  render(<Host />);
  return { onOpenResources, props };
}

// They live in the Resources dialog, which the menu's last row opens
// (docs/specs/008-canvas/element-menu-quick-bar.md "Resources").
const resources = () =>
  screen.queryAllByRole('button').filter((b) => b.textContent?.trim() === 'Resources');

describe('a Plan item’s element menu', () => {
  it('has none of them on a board, view, card or Sheet', () => {
    for (const kind of ['plan-board', 'plan-view', 'plan-card', 'plan-sheet'] as const) {
      open({ ...createShape(kind, 0, 0), id: kind });
      expect(resources()).toHaveLength(0);
      cleanup();
    }
  });

  it('keeps them on any other element, behind a Resources row that opens the dialog', () => {
    const target = { ...createShape('square', 0, 0), id: 'sq' };
    const { onOpenResources, props } = open(target);
    expect(resources()).toHaveLength(1);
    const row = resources()[0]!;
    expect(row.getAttribute('aria-haspopup')).toBe('dialog');
    // No side flyout: the row hands the element to the host, which closes the menu and opens the dialog.
    fireEvent.click(row);
    expect(onOpenResources).toHaveBeenCalledWith('sq');
    expect(document.querySelector('[data-element-resources]')).toBeNull();
    expect(quickBarItems(target as BoxedElement, props).map((i) => i.label)).toEqual([
      'Assign Action',
      'Add Link',
      'Add Note',
    ]);
  });
});
