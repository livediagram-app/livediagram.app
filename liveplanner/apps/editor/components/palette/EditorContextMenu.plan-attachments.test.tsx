// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createShape, type Element } from '@liveplanner/project';
import { EditorContextMenu } from './EditorContextMenu';
import type { EditorContextMenuProps } from './EditorContextMenu.types';

// docs/specs/026-plan/plan-mode.md "Nothing attached to Plan items": a Plan item's element menu offers no Assign
// Action, Add Comment, Add Link or Add Note on its quick bar, whoever opens it; any other element keeps them.
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});
afterEach(cleanup);

function open(target: Element) {
  const given: Record<string, unknown> = {
    menu: { mode: 'element', elementId: target.id, x: 10, y: 10 },
    elements: [target],
    layers: [],
    theme: undefined,
  };
  // Every handler is a stub; only what the menu reads as data is given.
  const props = new Proxy(given, {
    get: (t, k: string) => (k in t ? t[k] : vi.fn()),
    has: () => true,
  }) as unknown as EditorContextMenuProps;
  // Called as the body of a host, so the menu reads its props through the proxy (a spread copies only own keys).
  const Host = () => EditorContextMenu(props);
  render(<Host />);
}

// They live in the menu's Resources category (docs/specs/008-canvas/element-menu-quick-bar.md "Resources").
const resources = () =>
  screen.queryAllByRole('button').filter((b) => b.textContent?.trim() === 'Resources');
const collaborate = () => {
  const row = resources()[0];
  if (!row) return [];
  fireEvent.click(row);
  return [...document.querySelectorAll('[data-element-resources] [data-option]')].map(
    (b) => b.querySelector('.truncate')?.textContent ?? '',
  );
};

describe('a Plan item’s element menu', () => {
  it('has none of them on a board, view, card or Sheet', () => {
    for (const kind of ['plan-board', 'plan-view', 'plan-card', 'plan-sheet'] as const) {
      open({ ...createShape(kind, 0, 0), id: kind });
      expect(collaborate()).toHaveLength(0);
      cleanup();
    }
  });

  it('keeps them on any other element', () => {
    open({ ...createShape('square', 0, 0), id: 'sq' });
    expect(resources()).toHaveLength(1);
    expect(collaborate()).toEqual(['Assign Action', 'Add Link', 'Add Note']);
  });
});
