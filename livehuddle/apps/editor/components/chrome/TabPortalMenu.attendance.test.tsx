// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import type { Tab } from '@livehuddle/document';
import { PortalMenu } from './TabPortalMenu';
import { TabPill, type TabPillCtx } from './TabPill';

vi.mock('@liveworkspace/workbench/lib/clamp-to-viewport', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@liveworkspace/workbench/lib/clamp-to-viewport')>()),
  clampToViewport: () => ({ x: 0, y: 0 }),
}));

// Attendance in the tab menu (docs/specs/012-collaboration/tab-attendance.md "Where it shows"): an Editor's menu
// gains the row, a Participant's tab menu (otherwise closed to them) opens with that row alone, and a Viewer gets
// neither the row nor the menu.

type Props = ComponentProps<typeof PortalMenu>;

function props(over: Partial<Props> = {}): Props {
  const noop = () => {};
  const anchor = document.createElement('button');
  document.body.appendChild(anchor);
  return {
    anchor,
    onClose: noop,
    onRename: noop,
    onDuplicate: noop,
    onClearContent: noop,
    onImport: noop,
    onExport: noop,
    onCopyTo: noop,
    selfId: 'me',
    otherDocuments: [],
    folderNames: [],
    currentFolder: null,
    onMoveToFolder: noop,
    onRemoveFromFolder: noop,
    onDelete: noop,
    canDelete: true,
    canClearContent: true,
    ...over,
  };
}

afterEach(() => cleanup());

describe('Attendance in the tab menu', () => {
  it('sits among an Editor’s rows and opens the dialog', () => {
    const onOpenAttendance = vi.fn();
    render(<PortalMenu {...props({ onOpenAttendance })} />);
    expect(screen.getByRole('button', { name: 'Rename' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Attendance' }));
    expect(onOpenAttendance).toHaveBeenCalledTimes(1);
  });

  it('is the one row of a read-only session’s menu', () => {
    render(<PortalMenu {...props({ onOpenAttendance: vi.fn(), attendanceOnly: true })} />);
    expect(screen.getByRole('button', { name: 'Attendance' })).toBeTruthy();
    for (const verb of ['Rename', 'Duplicate', 'Delete', 'Import', 'Export', 'Clear'])
      expect(screen.queryByRole('button', { name: verb })).toBeNull();
  });

  it('is absent when the session may not see it, and on a connected tab’s menu when it may', () => {
    render(<PortalMenu {...props()} />);
    expect(screen.queryByRole('button', { name: 'Attendance' })).toBeNull();
    cleanup();
    render(
      <PortalMenu
        {...props({
          onOpenAttendance: vi.fn(),
          connected: { broken: false, onConnectAgain: vi.fn() },
        })}
      />,
    );
    expect(screen.getByRole('button', { name: 'Attendance' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Remove Tab' })).toBeTruthy();
  });
});

describe('the tab pill of a read-only session', () => {
  const tab: Tab = { id: 't1', name: 'Lobby', elements: [] };
  const ctx = (over: Partial<TabPillCtx>): TabPillCtx => ({
    activeId: 't1',
    editingId: null,
    setEditingId: vi.fn(),
    menuFor: null,
    setMenuFor: vi.fn(),
    readOnly: true,
    isDark: false,
    onSelect: vi.fn(),
    onRename: vi.fn(),
    reorderDrag: {
      caretFor: () => null,
      handlersFor: () => ({}),
      isDragging: () => false,
    } as unknown as TabPillCtx['reorderDrag'],
    participantsByTab: new Map(),
    selfId: 'me',
    selfRole: 'participate',
    tabMenuProps: () => ({}) as ReturnType<TabPillCtx['tabMenuProps']>,
    ...over,
  });

  it('shows the menu to a Participant who may see Attendance', () => {
    const c = ctx({ attendance: true });
    const { container } = render(<TabPill tab={tab} ctx={c} />);
    expect(screen.getByRole('button', { name: 'Tab menu' })).toBeTruthy();
    fireEvent.contextMenu(container.firstElementChild as HTMLElement);
    expect(c.setMenuFor).toHaveBeenCalledWith('t1');
  });

  it('shows a Viewer no menu', () => {
    const c = ctx({ selfRole: 'view' });
    const { container } = render(<TabPill tab={tab} ctx={c} />);
    expect(screen.queryByRole('button', { name: 'Tab menu' })).toBeNull();
    fireEvent.contextMenu(container.firstElementChild as HTMLElement);
    expect(c.setMenuFor).not.toHaveBeenCalled();
  });
});
