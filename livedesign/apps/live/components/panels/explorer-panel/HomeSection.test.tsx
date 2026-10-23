// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { JumpBackInItem } from '@/app/explorer/home/home-model';

const item = (designId: string, name: string): JumpBackInItem => ({
  designId,
  name,
  href: `/design/${designId}`,
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
vi.mock('@/components/panels/DesignThumbnail', () => ({ DesignThumbnail: () => <span /> }));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
// The cards read the Explorer's tree for each design's row; this suite needs none.
vi.mock('../explorer-tree/PanelTreeContext', () => ({ usePanelTree: () => ({}) }));

import { HomeSection } from './PanelViews';

const show = (current: string | null) =>
  render(
    <HomeSection
      ownerId="me"
      currentDesignId={current}
      onOpenDesign={() => {}}
      onSeeTimeline={() => {}}
    />,
  );

// docs/specs/013-workspace/explorer-structure.md "Home": never the open design, and never "No designs yet"
// to someone whose only design is the open one.
describe('HomeSection Jump Back In', () => {
  it('says nothing else is there yet when the open design is the only one', () => {
    home.current = { mostUsed: [item('d1', 'Roadmap')], recent: [] };
    show('d1');
    expect(screen.getByText('Nothing else yet')).toBeTruthy();
    expect(screen.queryByText('No designs yet')).toBeNull();
    expect(screen.queryByText('Roadmap')).toBeNull();
  });

  it('says there are no designs when there are none', () => {
    home.current = { mostUsed: [], recent: [] };
    show('d1');
    expect(screen.getByText('No designs yet')).toBeTruthy();
  });

  it('lists the other designs', () => {
    home.current = { mostUsed: [item('d1', 'Roadmap')], recent: [item('d2', 'Budget')] };
    show('d1');
    expect(screen.getByText('Budget')).toBeTruthy();
    expect(screen.queryByText('Nothing else yet')).toBeNull();
  });
});
