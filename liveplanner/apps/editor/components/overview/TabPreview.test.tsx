// @vitest-environment jsdom

// A tab tile's preview (docs/specs/026-plan/plan-overview.md "Tabs"): every tile in view shows its own preview at the
// same time and keeps it, inert for every role; loading, failed and empty states; a fault stays in its tile.
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tab } from '@liveplanner/project';
import { overviewModelOf } from './overview-model';
import { OverviewView, type OverviewAbilities } from './OverviewView';
import { TabPreview } from './TabPreview';
import { TYPES, boardTab, itemsOf } from './overview-fixtures.test-helpers';

const live = vi.hoisted(() => ({ renders: 0, throwFor: null as string | null }));

// The tab's own view: a control inside, to prove the preview keeps it out of reach.
vi.mock('./LivePlanPreview', () => ({
  fillingElementOf: (tab: Tab) => (tab.kind === 'board' ? tab.elements[0] : undefined),
  LivePlanPreview: ({ tab }: { tab: Tab }) => {
    live.renders += 1;
    if (live.throwFor === tab.id) throw new Error('boom');
    return (
      <span data-live-preview={tab.id}>
        <button type="button">Add card</button>
      </span>
    );
  },
}));
vi.mock('./useTabPreviewSvg', () => ({ useTabPreviewSvg: () => null }));
vi.mock('@/components/split/useTabBackdropPaint', () => ({
  useTabBackdropPaint: () => () => ({}),
}));

beforeEach(() => {
  live.renders = 0;
  live.throwFor = null;
  // A measured tile, as the browser lays it out.
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(288);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(180);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const TABS = ['a', 'b', 'c', 'd'].map((id) => boardTab(id, `Board ${id}`));
const MODEL = overviewModelOf({
  tabs: TABS,
  items: itemsOf([]),
  types: TYPES,
  loadedTabIds: new Set(TABS.map((t) => t.id)),
  owner: null,
  present: [],
  createdAt: 1,
});
const ROLES: Record<string, OverviewAbilities> = {
  Editor: { editPlan: true, addTab: true, editTypes: true, addType: true },
  Participant: { editPlan: false, addTab: false, editTypes: false, addType: true },
  Viewer: { editPlan: false, addTab: false, editTypes: false, addType: true },
};

function page(may: OverviewAbilities) {
  const byId = new Map(TABS.map((t) => [t.id, t]));
  return render(
    <OverviewView
      name="Plan"
      description=""
      dates={null}
      model={MODEL}
      preview={(tile) => (
        <TabPreview tab={byId.get(tile.id)!} tabs={[]} state={tile.state} failed={false} />
      )}
      now={2}
      may={may}
      actions={{
        openTab: vi.fn(),
        addTab: vi.fn(),
        editType: vi.fn(),
        addField: vi.fn(),
        addCard: vi.fn(),
        addTypeToBoard: vi.fn(),
        addType: vi.fn(),
        openCard: vi.fn(),
        rename: vi.fn(),
        describe: vi.fn(),
      }}
    />,
  );
}

describe('TabPreview', () => {
  it('shows every tab’s preview together and keeps them', async () => {
    const { container } = page(ROLES.Editor!);
    await waitFor(() => expect(container.querySelectorAll('[data-live-preview]')).toHaveLength(4));
    const drawn = live.renders;
    // A later frame draws nothing again, and no preview gave way to another.
    await act(() => new Promise((r) => setTimeout(r, 50)));
    expect(container.querySelectorAll('[data-live-preview]')).toHaveLength(4);
    expect(live.renders).toBe(drawn);
  });

  it.each(Object.keys(ROLES))(
    'is inert for a %s: nothing in it is focusable or read out',
    async (role) => {
      const { container } = page(ROLES[role]!);
      await waitFor(() =>
        expect(container.querySelectorAll('[data-live-preview]')).toHaveLength(4),
      );
      for (const preview of container.querySelectorAll<HTMLElement>('[data-tab-preview]')) {
        expect(preview.hasAttribute('inert')).toBe(true);
        expect(preview.getAttribute('aria-hidden')).toBe('true');
        expect(preview.className).toContain('pointer-events-none');
      }
      // The control inside a preview is out of the accessibility tree.
      expect(screen.queryByRole('button', { name: 'Add card' })).toBeNull();
    },
  );

  it('shows the loading sweep, then Couldn’t load preview for a tab that failed', () => {
    const tab = { id: 'w', name: 'Later', elements: [] } as unknown as Tab;
    const { container, rerender } = render(
      <TabPreview tab={tab} tabs={[]} state="loading" failed={false} />,
    );
    expect(container.querySelector('[data-tab-preview="loading"]')).not.toBeNull();
    rerender(<TabPreview tab={tab} tabs={[]} state="loading" failed />);
    expect(screen.getByText("Couldn't load preview")).toBeTruthy();
  });

  it('says a tab not started has nothing on it', () => {
    const tab = { id: 'e', name: 'Empty', kind: 'board', elements: [] } as unknown as Tab;
    render(<TabPreview tab={tab} tabs={[]} state="empty" failed={false} />);
    expect(screen.getByText('Nothing on this tab yet')).toBeTruthy();
  });

  it('keeps a preview that throws to its own tile', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    live.throwFor = 'b';
    const { container } = page(ROLES.Viewer!);
    await waitFor(() => expect(container.querySelectorAll('[data-live-preview]')).toHaveLength(3));
    const tile = container.querySelector<HTMLElement>('[data-tab-tile="b"]')!;
    expect(within(tile).getByText("Couldn't load preview")).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Plan Overview' })).toBeTruthy();
  });
});
