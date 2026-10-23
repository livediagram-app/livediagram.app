// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { JumpBackInItem } from '@/app/explorer/home/home-model';

const item = (projectId: string, name: string): JumpBackInItem => ({
  projectId,
  name,
  href: `/project/${projectId}`,
  savedAt: 1,
  empty: false,
  shareCode: null,
  useDays: 1,
  lastUsedAt: 1,
  localOnly: false,
});

const { home } = vi.hoisted(() => ({
  home: { current: { mostUsed: [] as JumpBackInItem[], recent: [] as JumpBackInItem[] } },
}));
vi.mock('@/app/explorer/home/useHome', () => ({
  useHome: () => ({
    status: 'ready',
    jumpBackIn: home.current,
    whatHappened: [],
    retry: () => {},
  }),
}));
vi.mock('@/components/panels/ProjectThumbnail', () => ({ ProjectThumbnail: () => <span /> }));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
// The cards read the Explorer's tree for each project's row; this suite needs none.
vi.mock('../explorer-tree/PanelTreeContext', () => ({ usePanelTree: () => ({}) }));

import { HomeSection } from './PanelViews';

const show = (current: string | null) =>
  render(<HomeSection ownerId="me" currentProjectId={current} onOpenProject={() => {}} />);

// docs/specs/013-workspace/explorer-structure.md "Home": never the open project, and never "No projects yet"
// to someone whose only project is the open one.
describe('HomeSection Jump Back In', () => {
  it('says nothing else is there yet when the open project is the only one', () => {
    home.current = { mostUsed: [item('d1', 'Roadmap')], recent: [] };
    show('d1');
    expect(screen.getByText('Nothing else yet')).toBeTruthy();
    expect(screen.queryByText('No plans yet')).toBeNull();
    expect(screen.queryByText('Roadmap')).toBeNull();
  });

  it('says there are no projects when there are none', () => {
    home.current = { mostUsed: [], recent: [] };
    show('d1');
    expect(screen.getByText('No plans yet')).toBeTruthy();
  });

  it('lists the other projects', () => {
    home.current = { mostUsed: [item('d1', 'Roadmap')], recent: [item('d2', 'Budget')] };
    show('d1');
    expect(screen.getByText('Budget')).toBeTruthy();
    expect(screen.queryByText('Nothing else yet')).toBeNull();
  });
});
