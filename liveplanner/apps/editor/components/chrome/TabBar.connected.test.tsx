// @vitest-environment jsdom

// A connected tab in the bar (liveworkspace/docs/specs/004-index/connected-tabs.md "How it looks"): its file's app and
// name; an Editor's menu keeps Remove Tab, its folder and, when broken, Connect Again, never Rename or Duplicate; a
// Viewer opens it and has no menu.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Tab } from '@liveplanner/project';
import {
  resetConnectedTabStoreForTests,
  setConnectedTabBroken,
} from '@liveworkspace/workbench/components/connect/connected-tab-store';
import { TabBar } from './TabBar';
import { tabBarProps as props } from './TabBar.test-props';

vi.mock('@liveworkspace/workbench/lib/clamp-to-viewport', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@liveworkspace/workbench/lib/clamp-to-viewport')>()),
  clampToViewport: () => ({ x: 0, y: 0 }),
}));

afterEach(() => {
  cleanup();
  resetConnectedTabStoreForTests();
});

const CONNECTION = { id: 'cn_abcdefghijklmnopqrstuvwx', app: 'livediagram', itemId: 'd1' } as const;
const TABS = [
  { id: 't1', name: 'First', elements: [] },
  { id: 'c1', name: 'Architecture', elements: [], connection: CONNECTION } as Tab,
];

describe('TabBar: a connected tab', () => {
  it("shows its file's app and offers an Editor only Remove Tab, its folder and Connect Again", () => {
    const onConnectAgain = vi.fn();
    const onDelete = vi.fn();
    render(<TabBar {...props({ tabs: TABS, activeId: 'c1', onConnectAgain, onDelete })} />);
    expect(
      screen.getByRole('button', {
        name: 'Architecture, connected livediagram file',
      }),
    ).toBeTruthy();
    act(() => setConnectedTabBroken(CONNECTION.id, true));
    fireEvent.click(screen.getByRole('button', { name: 'Tab menu' }));
    expect(screen.queryByRole('button', { name: /Rename/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Duplicate/ })).toBeNull();
    expect(screen.getByText('Organise in Tab Folder')).toBeTruthy();
    // Plain labelled rows, Remove last: no icon row holding the bin alone.
    const rows = ['Connect Again', 'Organise in Tab Folder', 'Remove Tab'].map((t) =>
      screen.getByText(t),
    );
    rows
      .slice(1)
      .forEach((row, i) =>
        expect(
          rows[i]!.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy(),
      );
    fireEvent.click(screen.getByText('Connect Again'));
    expect(onConnectAgain).toHaveBeenCalledWith('c1');
    fireEvent.click(screen.getByRole('button', { name: 'Tab menu' }));
    fireEvent.click(screen.getByRole('button', { name: /Remove Tab/ }));
    expect(onDelete).toHaveBeenCalledWith('c1');
  });

  it('never renames on a double-click, and has no menu for a Viewer', () => {
    const onSelect = vi.fn();
    render(<TabBar {...props({ tabs: TABS, activeId: 't1', readOnly: true, onSelect })} />);
    const tab = screen.getByRole('button', { name: /Architecture/ });
    fireEvent.click(tab);
    expect(onSelect).toHaveBeenCalledWith('c1');
    fireEvent.doubleClick(tab);
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Tab menu' })).toBeNull();
  });
});
