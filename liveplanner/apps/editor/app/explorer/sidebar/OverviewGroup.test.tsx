// @vitest-environment jsdom

// The sidebar's Overview group (docs/specs/013-workspace/explorer-structure.md#overview): Home, Inbox
// and Shared With Me, each opening its view, with the Inbox's badge counting what is assigned to
// the reader and the unread count on Home.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SelectedNode } from '../views';

const { track, explorer } = vi.hoisted(() => ({
  track: vi.fn(),
  explorer: { current: {} },
}));
vi.mock('@/lib/telemetry', () => ({ track }));
vi.mock('../ExplorerContext', () => ({ useExplorer: () => explorer.current }));

import { OverviewGroup } from './OverviewGroup';

const go = vi.fn();
const clearUnread = vi.fn();

function renderGroup(
  selected: SelectedNode = { kind: 'home' },
  unread = 3,
  assigned = 2,
  feed: { loading?: boolean; error?: boolean } = {},
) {
  explorer.current = {
    selected,
    go,
    shared: [],
    timelineUnread: { count: unread, clear: clearUnread },
    activity: {
      assignedToMe: Array.from({ length: assigned }, (_, i) => ({ id: `a${i}` })),
      loading: false,
      error: false,
      ...feed,
    },
  };
  render(<OverviewGroup divider="titles" first />);
}

const rows = () =>
  [
    ...screen
      .getByRole('tree', { name: 'Overview' })
      .querySelectorAll(':scope > [role="treeitem"]'),
  ].map((el) => el.getAttribute('data-tree-label'));
const item = (name: string) => screen.getByRole('treeitem', { name: new RegExp(`^${name}`) });
const activate = (name: string) =>
  fireEvent.click(item(name).querySelector('[data-tree-row] [data-tree-activate]')!);
const labelOf = (name: string) => item(name).getAttribute('aria-label');

beforeEach(() => {
  track.mockReset();
  go.mockReset();
  clearUnread.mockReset();
});
afterEach(cleanup);

describe('OverviewGroup', () => {
  it('lists Home, Inbox and Shared With Me, in that order, with no Timeline row', () => {
    renderGroup();
    expect(rows()).toEqual(['Home', 'Inbox', 'Shared With Me']);
  });

  it('opens the Inbox and reports Sidebar.Inbox', () => {
    renderGroup();
    activate('Inbox');
    expect(go).toHaveBeenCalledWith({ kind: 'inbox' });
    expect(track).toHaveBeenCalledWith('UI', 'Selected', 'Sidebar.Inbox');
  });

  it('highlights the row of the current view', () => {
    renderGroup({ kind: 'inbox' });
    expect(item('Inbox').getAttribute('aria-selected')).toBe('true');
    expect(item('Home').getAttribute('aria-selected')).toBe('false');
    cleanup();
    renderGroup({ kind: 'shared' });
    expect(item('Shared With Me').getAttribute('aria-selected')).toBe('true');
    expect(item('Inbox').getAttribute('aria-selected')).toBe('false');
  });

  it('badges Home with the unread count and the Inbox with what is assigned', () => {
    renderGroup({ kind: 'home' }, 3, 2);
    expect(labelOf('Home')).toBe('Home (3)');
    expect(labelOf('Inbox')).toBe('Inbox (2)');
    expect(labelOf('Shared With Me')).toBe('Shared With Me');
  });

  it('shows the Inbox badge at zero', () => {
    renderGroup({ kind: 'home' }, 0, 0);
    expect(labelOf('Inbox')).toBe('Inbox (0)');
  });

  it('shows no Inbox badge while the Inbox loads or after it failed', () => {
    renderGroup({ kind: 'home' }, 0, 0, { loading: true });
    expect(labelOf('Inbox')).toBe('Inbox');
    cleanup();
    renderGroup({ kind: 'home' }, 0, 0, { error: true });
    expect(labelOf('Inbox')).toBe('Inbox');
  });
});
