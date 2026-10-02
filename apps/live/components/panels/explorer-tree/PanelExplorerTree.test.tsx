// @vitest-environment jsdom

// The floating Explorer panel's tree (docs/specs/013-workspace/explorer-structure.md#the-floating-explorer-panel).

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DocumentListItem, SharedWithItem } from '@/lib/api-client';
import { MinimalChromeProvider } from '@/components/providers/minimal-chrome';
import { LOCAL_ONLY_DESCRIPTION } from '@/components/primitives/LocalOnlyPill';
import { PanelExplorerTree } from './PanelExplorerTree';
import type { PanelTree } from './PanelTreeContext';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

const doc = (id: string, name: string, over: Partial<DocumentListItem> = {}) =>
  ({
    id,
    name,
    ownerId: 'me',
    folderId: null,
    savedAt: 1,
    source: null,
    empty: true,
    ...over,
  }) as DocumentListItem;

const PLAN = doc('d1', 'Plan', { folderId: 'f1' });
const NOTES = doc('d2', 'Loose notes');
const LOCAL = doc('l1', 'Workshop notes', { ownerId: 'offline' });

function Harness({
  offline = [LOCAL],
  teams = [] as { id: string; name: string }[],
  shared = [] as SharedWithItem[],
  minimal = false,
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const tree: PanelTree = {
    ownerId: 'me',
    currentDocumentId: 'd1',
    exitingDocumentIds: new Set(),
    expanded,
    onToggle: (key) => setExpanded((p) => ({ ...p, [key]: !p[key] })),
    onOpenDocument: vi.fn(),
    pendingRenameFolderId: null,
    onRenameFolderCommitted: vi.fn(),
    onCreateChild: vi.fn(),
    onCreateTeamChild: vi.fn(),
  };
  return (
    <MinimalChromeProvider value={minimal}>
      <PanelExplorerTree
        tree={tree}
        shared={shared}
        ownIndex={{
          foldersByParent: new Map([[null, [{ id: 'f1', name: 'Projects', parentId: null }]]]),
          documentsByFolder: new Map([
            [null, [NOTES]],
            ['f1', [PLAN]],
          ]),
        }}
        offlineDocuments={offline}
        teams={teams}
        foldersByTeam={new Map()}
        documentsByTeam={new Map()}
      />
    </MinimalChromeProvider>
  );
}

const topRows = (group: string) =>
  [...screen.getByRole('tree', { name: group }).querySelectorAll(':scope > [role="treeitem"]')].map(
    (el) => el.getAttribute('data-tree-label'),
  );
const item = (name: string | RegExp) => screen.getByRole('treeitem', { name });
const activate = (name: string | RegExp) =>
  fireEvent.click(item(name).querySelector('[data-tree-row] [data-tree-activate]')!);

const assign = vi.fn();
beforeEach(() => {
  assign.mockReset();
  vi.stubGlobal('location', { ...window.location, assign });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('PanelExplorerTree', () => {
  it('shows the three groups in place of the tabs', () => {
    render(<Harness />);
    expect(screen.getAllByRole('heading').map((h) => h.textContent)).toEqual([
      'Overview',
      'Spaces',
      'More',
    ]);
    expect(screen.queryByRole('tab')).toBeNull();
  });

  it('keeps Overview, and leaves invites, team creation and the nudge to the Explorer', () => {
    render(<Harness teams={[{ id: 't1', name: 'Design guild' }]} />);
    expect(topRows('Overview')).toEqual(['Home', 'Activity', 'Shared with me']);
    expect(topRows('Spaces')).toEqual(['My documents', 'Design guild']);
    expect(screen.queryByText('New team')).toBeNull();
    expect(screen.queryByText(/Sign in to access Teams/)).toBeNull();
  });

  it('shows This browser only while it holds documents', () => {
    render(<Harness />);
    expect(topRows('More')).toEqual(['This browser', 'Library', 'Trash']);
    cleanup();
    render(<Harness offline={[]} />);
    expect(topRows('More')).toEqual(['Library', 'Trash']);
  });

  it('opens compact, then opens My documents in place to its buckets, folders and documents', () => {
    render(<Harness />);
    expect(item('My documents').getAttribute('aria-expanded')).toBe('false');
    activate('My documents');
    expect(item('My documents').getAttribute('aria-expanded')).toBe('true');
    expect(item(/^Unsorted/)).toBeTruthy();
    expect(item('Generated')).toBeTruthy();
    activate('Projects');
    expect(item('Plan').getAttribute('aria-selected')).toBe('true');
    expect(assign).not.toHaveBeenCalled();
  });

  it('marks a document in this browser Local only, with what it means', () => {
    render(<Harness />);
    activate(/^This browser/);
    const local = item('Workshop notes');
    expect(local.querySelector('a')?.textContent).toContain('Local only');
    const id = local.getAttribute('aria-describedby');
    expect(document.getElementById(id!)?.textContent).toBe(LOCAL_ONLY_DESCRIPTION);
  });

  it('sends rows without documents to their Explorer page', () => {
    render(<Harness />);
    activate('Home');
    activate('Trash');
    expect(assign.mock.calls).toEqual([['/explorer/timeline'], ['/explorer/trash']]);
  });

  it('opens Shared with me in place when something is shared', () => {
    const shared = [
      { id: 's1', name: 'Their board', shareCode: 'abc', role: 'view', savedAt: 1 },
    ] as unknown as SharedWithItem[];
    render(<Harness shared={shared} />);
    activate(/^Shared with me/);
    expect(item('Their board')).toBeTruthy();
    expect(assign).not.toHaveBeenCalled();
  });

  it('swaps titles for hairlines under Minimal chrome, none above the first group', () => {
    const { container } = render(<Harness minimal />);
    expect(container.querySelectorAll('[data-sidebar-separator]')).toHaveLength(2);
    expect(screen.getByRole('heading', { name: 'Overview' }).className).toMatch(/\bsr-only\b/);
  });
});
