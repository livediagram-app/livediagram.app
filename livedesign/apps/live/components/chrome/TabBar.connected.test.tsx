// @vitest-environment jsdom

// A connected tab in the bar (liveworkspace/docs/specs/004-index/connected-tabs.md "How it looks"): its file's app and
// name; an Editor's menu keeps Rename, Remove Tab, its folder and, when broken, Connect Again, never Duplicate; an
// Editor renames it from the menu or a double-click ("A tab's own name"), and a renamed one names its file; a Viewer
// opens it, renames nothing and has no menu.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livedesign/design';
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

const CONNECTION = { id: 'cn_abcdefghijklmnopqrstuvwx', app: 'liveplanner', itemId: 'p1' } as const;
const TABS = [
  { id: 't1', name: 'First', elements: [] },
  { id: 'c1', name: 'Launch plan', elements: [], connection: CONNECTION } as Tab,
];

describe('TabBar: a connected tab', () => {
  it("shows its file's app and offers an Editor only Rename, Remove Tab, its folder and Connect Again", () => {
    const onConnectAgain = vi.fn();
    const onDelete = vi.fn();
    render(<TabBar {...props({ tabs: TABS, activeId: 'c1', onConnectAgain, onDelete })} />);
    expect(
      screen.getByRole('button', {
        name: 'Launch plan, connected liveplanner file',
      }),
    ).toBeTruthy();
    act(() => setConnectedTabBroken(CONNECTION.id, true));
    fireEvent.click(screen.getByRole('button', { name: 'Tab menu' }));
    expect(screen.queryByRole('button', { name: /Duplicate/ })).toBeNull();
    expect(screen.getByText('Organise in Tab Folder')).toBeTruthy();
    // Plain labelled rows, Rename first, Remove last: no icon row holding the bin alone.
    const rows = ['Rename', 'Connect Again', 'Organise in Tab Folder', 'Remove Tab'].map((t) =>
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

  it('renames from its menu, an empty name handed on so it follows its file again', () => {
    const onRename = vi.fn();
    render(
      <TabBar {...props({ tabs: TABS, activeId: 'c1', onRename, onConnectAgain: vi.fn() })} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Tab menu' }));
    fireEvent.click(screen.getByText('Rename'));
    const field = screen.getByRole('textbox', { name: 'Tab name' });
    fireEvent.change(field, { target: { value: '   ' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(onRename).toHaveBeenCalledWith('c1', '');
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('renames on a double-click for an Editor, and Escape keeps the name', () => {
    const onRename = vi.fn();
    render(<TabBar {...props({ tabs: TABS, activeId: 'c1', onRename })} />);
    const tab = () => screen.getByRole('button', { name: /Launch plan, connected/ });
    fireEvent.doubleClick(tab());
    const field = screen.getByRole('textbox', { name: 'Tab name' });
    fireEvent.keyDown(field, { key: 'Escape' });
    expect(screen.queryByRole('textbox')).toBeNull();
    fireEvent.doubleClick(tab());
    fireEvent.change(screen.getByRole('textbox', { name: 'Tab name' }), {
      target: { value: 'Plan' },
    });
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Tab name' }), { key: 'Enter' });
    expect(onRename).toHaveBeenCalledWith('c1', 'Plan');
  });

  it("names a renamed tab's file for a screen reader", () => {
    const renamed = [TABS[0]!, { ...TABS[1]!, name: 'Plan', targetName: 'Launch plan' } as Tab];
    render(<TabBar {...props({ tabs: renamed, activeId: 'c1' })} />);
    expect(
      screen.getByRole('button', { name: 'Plan, connected to Launch plan, a liveplanner file' }),
    ).toBeTruthy();
  });

  it('never renames on a double-click, and has no menu for a Viewer', () => {
    const onSelect = vi.fn();
    render(<TabBar {...props({ tabs: TABS, activeId: 't1', readOnly: true, onSelect })} />);
    const tab = screen.getByRole('button', { name: /Launch plan/ });
    fireEvent.click(tab);
    expect(onSelect).toHaveBeenCalledWith('c1');
    fireEvent.doubleClick(tab);
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Tab menu' })).toBeNull();
  });
});
