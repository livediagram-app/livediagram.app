// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import type { Tab } from '@livehuddle/document';
import { TabMenu } from './TabMenu';
import { TabPill, type TabPillCtx } from './TabPill';

vi.mock('@liveworkspace/workbench/lib/clamp-to-viewport', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@liveworkspace/workbench/lib/clamp-to-viewport')>()),
  clampToViewport: () => ({ x: 0, y: 0 }),
}));
// The picker itself is the dialog's own test; here, only what the menu hands it.
vi.mock('@/components/dialogs/TabOrganiseDialogs', () => ({
  AddTabToDocumentDialog: (p: {
    ownerId: string;
    otherDocuments: { id: string }[];
    onPick: (id: string) => void;
  }) => (
    <button type="button" onClick={() => p.onPick(p.otherDocuments[0]!.id)}>
      {`Pick as ${p.ownerId}`}
    </button>
  ),
}));

// livehuddle's tab menu (liveworkspace/docs/specs/022-interface-design/action-parity.md "The tab menu"): the shared
// menu with this app's words, its toolbar spread evenly (a space's tabs have no lock), and its own rows, Attendance
// (docs/specs/012-collaboration/tab-attendance.md "Where it shows"); Send Stickies to Plan went with the
// sticky notes (docs/specs/002-project-scope/not-in-livehuddle.md "The Write category"). An Editor's menu gains the Attendance row, a Participant's tab menu
// (otherwise closed to them) opens with that row alone, and a Viewer gets neither the row nor the menu.

type Props = ComponentProps<typeof TabMenu>;
const noop = () => {};
const props = (over: Partial<Props> = {}): Props => ({
  anchor: document.body.appendChild(document.createElement('button')),
  onClose: noop,
  onRename: noop,
  onDuplicate: noop,
  onClearContent: noop,
  onImport: noop,
  onExport: noop,
  onCopyTo: noop,
  selfId: 'me',
  otherDocuments: [{ id: 's2', name: 'Other' }],
  folders: [],
  currentFolder: null,
  onMoveToFolder: noop,
  onRemoveFromFolder: noop,
  onSetFolderColour: noop,
  onDelete: noop,
  canDelete: true,
  canClearContent: true,
  ...over,
});
const labels = () =>
  Array.from(screen.getByRole('dialog').querySelectorAll('button'), (b) =>
    (b.getAttribute('aria-label') ?? b.textContent ?? '').trim(),
  );

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

describe('the tab menu', () => {
  it('reads as it always has, its toolbar spread evenly with no lock', () => {
    render(<TabMenu {...props()} />);
    expect(labels()).toEqual([
      'Rename',
      'Duplicate',
      'Delete',
      'Organise in Tab Folder',
      'Add to Another Space',
      'Import',
      'Export',
      'Clear',
    ]);
    expect(screen.getByRole('button', { name: 'Delete' }).closest('.justify-between')).not.toBe(
      null,
    );
  });

  it('adds the tab to another space through its picker', async () => {
    const onCopyTo = vi.fn();
    render(<TabMenu {...props({ onCopyTo })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add to Another Space' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Pick as me' }));
    expect(onCopyTo).toHaveBeenCalledWith('s2');
  });

  it('has no Send Stickies to Plan row', () => {
    render(<TabMenu {...props()} />);
    expect(labels().slice(-2)).toEqual(['Export', 'Clear']);
    expect(screen.queryByRole('button', { name: 'Send Stickies to Plan' })).toBeNull();
  });
});

describe('Attendance in the tab menu', () => {
  it('sits among an Editor’s rows, in a group of its own, and opens the dialog', () => {
    const onOpenAttendance = vi.fn();
    render(<TabMenu {...props({ onOpenAttendance })} />);
    expect(labels().slice(4, 7)).toEqual(['Add to Another Space', 'Attendance', 'Import']);
    fireEvent.click(screen.getByRole('button', { name: 'Attendance' }));
    expect(onOpenAttendance).toHaveBeenCalledTimes(1);
  });

  it('is the one row of a read-only session’s menu', () => {
    render(<TabMenu {...props({ onOpenAttendance: vi.fn(), attendanceOnly: true })} />);
    expect(labels()).toEqual(['Attendance']);
  });

  it('is absent when the session may not see it, and on a connected tab’s menu when it may', () => {
    render(<TabMenu {...props()} />);
    expect(screen.queryByRole('button', { name: 'Attendance' })).toBeNull();
    cleanup();
    render(
      <TabMenu
        {...props({
          onOpenAttendance: vi.fn(),
          connected: { broken: false, onConnectAgain: vi.fn() },
        })}
      />,
    );
    // A connected tab's name follows its file: no Rename.
    expect(labels()).toEqual(['Organise in Tab Folder', 'Attendance', 'Remove Tab']);
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
