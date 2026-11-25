// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createTable } from '@livedocuments/document';
import { EditorContextMenu } from './EditorContextMenu';
import type { EditorContextMenuProps } from './EditorContextMenu.types';

// docs/specs/008-canvas/canvas-and-palette.md "A category that opens a dialog": a locked element's rows are not
// edited, so its menu offers no row that opens its rows dialog (the dialog would close the moment it opened).
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});
afterEach(cleanup);

function open(onEditRows: EditorContextMenuProps['onEditRows']) {
  const target = createTable(0, 0);
  const given: Record<string, unknown> = {
    menu: { mode: 'element', elementId: target.id, x: 10, y: 10 },
    elements: [target],
    layers: [],
    theme: undefined,
    onEditRows,
  };
  const props = new Proxy(given, {
    get: (t, k: string) => (k in t ? t[k] : vi.fn()),
    has: () => true,
  }) as unknown as EditorContextMenuProps;
  const Host = () => EditorContextMenu(props);
  render(<Host />);
}

const tableRow = () =>
  screen.queryAllByRole('button').some((b) => b.textContent?.trim() === 'Table');

describe('a table’s rows dialog row', () => {
  it('is offered when the host hands the menu a way to open it', () => {
    open(vi.fn());
    expect(tableRow()).toBe(true);
  });

  it('is left out on a locked table, where the host hands it none', () => {
    open(undefined);
    expect(tableRow()).toBe(false);
  });
});
