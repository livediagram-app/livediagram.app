// @vitest-environment jsdom

// The editor's Explorer pane's rows for a section that holds projects (docs/specs/013-workspace/explorer-structure.md
// "The pane").

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectListItem, SharedWithItem } from '@/lib/api-client';
import { THIS_BROWSER_DESCRIPTION } from '@/components/primitives/ThisBrowserPill';
import { PanelExplorerTree, type PanelTreeSection } from './PanelExplorerTree';
import type { PanelTree } from './PanelTreeContext';

const { track } = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock('@/lib/telemetry', () => ({ track }));

const doc = (id: string, name: string, over: Partial<ProjectListItem> = {}) =>
  ({
    id,
    name,
    ownerId: 'me',
    folderId: null,
    savedAt: 1,
    source: null,
    empty: true,
    ...over,
  }) as ProjectListItem;

const PLAN = doc('d1', 'Plan', { folderId: 'f1' });
const NOTES = doc('d2', 'Loose notes');
const LOCAL = doc('l1', 'Workshop notes', { ownerId: 'offline' });

function Harness({
  section,
  offline = [LOCAL],
  teams = [] as { id: string; name: string }[],
  shared = [] as SharedWithItem[],
  teamDocs = [] as ProjectListItem[],
}: {
  section: PanelTreeSection;
  offline?: ProjectListItem[];
  teams?: { id: string; name: string }[];
  shared?: SharedWithItem[];
  teamDocs?: ProjectListItem[];
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [folderId, setFolderId] = useState<string | null>(null);
  const tree: PanelTree = {
    ownerId: 'me',
    currentProjectId: 'd1',
    exitingProjectIds: new Set(),
    expanded,
    onToggle: (key) => setExpanded((p) => ({ ...p, [key]: !p[key] })),
    onOpenProject: vi.fn(),
    pendingRenameFolderId: null,
    onRenameFolderCommitted: vi.fn(),
    onCreateChild: vi.fn(),
    onCreateTeamChild: vi.fn(),
  };
  return (
    <PanelExplorerTree
      section={section}
      rootLabel="My Work"
      tree={tree}
      shared={shared}
      ownIndex={{
        foldersByParent: new Map([[null, [{ id: 'f1', name: 'Projects', parentId: null }]]]),
        projectsByFolder: new Map([
          [null, [NOTES]],
          ['f1', [PLAN]],
        ]),
      }}
      offlineProjects={offline}
      teams={teams}
      foldersByTeam={new Map()}
      projectsByTeam={new Map(teams.map((t) => [t.id, teamDocs]))}
      folderId={folderId}
      onOpenFolder={setFolderId}
    />
  );
}

const rows = () =>
  [...document.querySelectorAll('[data-pane-row]')].map((el) => el.getAttribute('aria-label'));
const row = (name: string | RegExp) => screen.getByRole('button', { name });

const assign = vi.fn();
beforeEach(() => {
  // Thumbnails load as they scroll into view.
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  assign.mockReset();
  track.mockReset();
  vi.stubGlobal('location', { ...window.location, assign });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('PanelExplorerTree', () => {
  it('shows My Work as its folders, then its projects, a folder opening in place under the back bar', () => {
    render(<Harness section={{ kind: 'mine' }} />);
    expect(rows()).toEqual(['Projects', 'Loose notes']);
    expect(screen.queryByText('Unsorted')).toBeNull();
    fireEvent.click(row('Projects'));
    expect(rows()).toEqual(['Plan']);
    expect(row('Plan').getAttribute('aria-current')).toBe('true');
    // The import and export screens' back bar: back to the root, the folder as its chip.
    const back = screen.getByRole('button', { name: /^My Work/ });
    expect(back.textContent).toContain('Projects');
    fireEvent.click(back);
    expect(rows()).toEqual(['Projects', 'Loose notes']);
    expect(assign).not.toHaveBeenCalled();
  });

  it('marks a project in this browser This Browser, with what it means', () => {
    render(<Harness section={{ kind: 'browser' }} />);
    expect(rows()).toEqual([`Workshop notes. ${THIS_BROWSER_DESCRIPTION}`]);
    expect(screen.getByText('This Browser')).toBeTruthy();
  });

  it('lists what is shared with the reader', () => {
    const shared = [
      { id: 's1', name: 'Their board', shareCode: 'abc', role: 'view', savedAt: 1 },
    ] as unknown as SharedWithItem[];
    render(<Harness section={{ kind: 'shared' }} shared={shared} />);
    expect(rows()).toEqual(['Their board']);
  });

  it("shows a team's root projects", () => {
    render(
      <Harness
        section={{ kind: 'team', id: 't1' }}
        teams={[{ id: 't1', name: 'Design guild' }]}
        teamDocs={[doc('t-d1', 'Guild charter', { ownerId: 'them' })]}
      />,
    );
    expect(rows()).toEqual(['Guild charter']);
  });

  it('says so in the Explorer empty state when a place is empty', () => {
    render(<Harness section={{ kind: 'shared' }} />);
    expect(screen.getByRole('heading', { name: 'Nothing shared with you yet' })).toBeTruthy();
    cleanup();
    render(<Harness section={{ kind: 'browser' }} offline={[]} />);
    expect(screen.getByRole('heading', { name: 'Nothing in this browser' })).toBeTruthy();
  });
});
