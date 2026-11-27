// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { TabMenu, type TabMenuProps } from './TabMenu';

vi.mock('../../lib/clamp-to-viewport', () => ({ clampToViewport: () => ({ x: 0, y: 0 }) }));

// Who sees what in the tab menu (liveworkspace/docs/specs/022-interface-design/action-parity.md "The tab menu", "Who
// sees it"). The tab bar decides who opens it: an Editor gets the whole menu, a Viewer none, a Participant none
// except livehuddle's Attendance row alone. Each editor's TabPill.test.tsx holds the opening; this file holds what
// the menu shows each one, as each tab bar hands it over.

type Role = 'edit' | 'participate' | 'view';
const noop = () => {};
const attendance = (
  <button type="button" onClick={noop}>
    Attendance
  </button>
);

// The menu a tab bar opens for a role, or nothing: a stand-in for each editor's tab bar gate (`readOnly` is true for a
// Viewer and a Participant), with livehuddle's Attendance-only menu for a session that may see Attendance.
function TabBarMenu({ role, attendanceRow }: { role: Role; attendanceRow?: ReactNode }) {
  const readOnly = role !== 'edit';
  if (readOnly && !attendanceRow) return null;
  const anchor = document.body.appendChild(document.createElement('button'));
  const props: TabMenuProps = {
    anchor,
    onClose: noop,
    words: { item: 'tab', holder: 'space' },
    onRename: noop,
    onDuplicate: noop,
    onClearContent: noop,
    onImport: noop,
    onExport: noop,
    onDelete: noop,
    onToggleLock: noop,
    onMoveToFolder: noop,
    canDelete: true,
    canClearContent: true,
    ownGroup: attendanceRow,
    only: readOnly ? attendanceRow : undefined,
  };
  return <TabMenu {...props} />;
}

const EVERY_VERB = [
  'Rename',
  'Duplicate',
  'Lock Tab',
  'Delete',
  'Organise in Tab Folder',
  'Import',
  'Export',
  'Clear',
];

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

describe('the tab menu by role', () => {
  it('gives an Editor every verb', () => {
    render(<TabBarMenu role="edit" />);
    for (const verb of EVERY_VERB) expect(screen.getByRole('button', { name: verb })).toBeTruthy();
  });

  it('gives an Editor who may see Attendance that row among the rest', () => {
    render(<TabBarMenu role="edit" attendanceRow={attendance} />);
    expect(screen.getByRole('button', { name: 'Attendance' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Rename' })).toBeTruthy();
  });

  it('gives a Participant no menu', () => {
    render(<TabBarMenu role="participate" />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('gives a Participant who may see Attendance that row alone, no verb that changes the tab', () => {
    render(<TabBarMenu role="participate" attendanceRow={attendance} />);
    expect(screen.getByRole('button', { name: 'Attendance' })).toBeTruthy();
    for (const verb of EVERY_VERB) expect(screen.queryByRole('button', { name: verb })).toBeNull();
  });

  it('gives a Viewer no menu', () => {
    render(<TabBarMenu role="view" />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
