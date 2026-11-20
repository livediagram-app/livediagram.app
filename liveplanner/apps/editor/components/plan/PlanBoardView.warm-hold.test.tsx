// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ITEM_TYPES, presetSetup, type Item } from '@liveplanner/items';
import type { ShapeElement } from '@liveplanner/project';
import { PlanBoardView } from './PlanBoardView';
import { PlanProvider, type PlanContextValue } from './PlanContext';
import { createSelectionStore } from '@liveworkspace/workbench/lib/selection-store';
import { SelectionStoreProvider } from '@liveworkspace/workbench/hooks/canvas/useSelectionStore';
import { warmRightsOf } from '@/lib/last-seen-plan';

// docs/specs/006-project/offline-mode.md "The board holds its place" (Work Tracker 1112): a warm paint runs as a Viewer,
// so an Editor's example cards notice and card type chips came in at the catch-up and pushed the columns down about
// 50 px. The paint now draws them, inert, for the role the copy was kept with, and a Viewer's copy draws neither.
vi.mock('@liveworkspace/workbench/hooks/ui/useIsMobileViewport', () => ({
  useIsMobileViewport: () => false,
}));

afterEach(cleanup);

const item = (id: string, key: number, status: string, assignee?: string): Item =>
  ({
    id,
    key,
    type: 'task',
    fields: {
      title: `Card ${key}`,
      status,
      ...(assignee ? { assignee: { id: assignee, name: 'Sam', color: '#7c3aed' } } : {}),
    },
    rank: `a${key}`,
    createdAt: 0,
    updatedAt: 0,
  }) as unknown as Item;

const cards = [item('i1', 1, 'todo'), item('i2', 2, 'doing'), item('i3', 3, 'review')].map((c, i) =>
  // The first card is a template's example card, so an Editor's board shows the notice.
  i === 0 ? { ...c, fields: { ...c.fields, example: true } } : c,
);

const plan = (over: Partial<PlanContextValue> = {}): PlanContextValue =>
  ({
    items: new Map(cards.map((c) => [c.id, c])),
    types: ITEM_TYPES,
    status: 'ready',
    self: null,
    people: [],
    canEdit: true,
    canEditCards: true,
    canVote: true,
    presence: new Map(),
    statusNames: new Map(),
    statusBoards: new Map(),
    openItemId: null,
    retry: vi.fn(),
    openItem: vi.fn(),
    openNewItem: vi.fn(),
    addItem: vi.fn(),
    moveItem: vi.fn(),
    updateBoard: vi.fn(),
    createTypeForBoard: vi.fn(),
    announce: vi.fn(),
    setDragging: vi.fn(),
    ...over,
  }) as unknown as PlanContextValue;

const VIEWER = { canEdit: false, canEditCards: false } as const;

const element = (lanes = false): ShapeElement =>
  ({
    id: 'b1',
    type: 'shape',
    shape: 'plan-board',
    x: 0,
    y: 0,
    width: 1400,
    height: 600,
    planBoard: {
      ...presetSetup('kanban'),
      widgets: [],
      ...(lanes ? { swimlaneBy: 'assignee' } : {}),
    },
  }) as unknown as ShapeElement;

const draw = (value = plan(), lanes = false) =>
  render(
    <SelectionStoreProvider store={createSelectionStore()}>
      <PlanProvider value={value}>
        <PlanBoardView element={element(lanes)} />
      </PlanProvider>
    </SelectionStoreProvider>,
  );

const chips = () => document.querySelector('[data-card-type-chips]');

describe('a warm paint keeps room for the chips the catch-up brings', () => {
  it("draws an Editor's chips inert while it paints as a Viewer", () => {
    draw(plan({ ...VIEWER, warmRights: warmRightsOf('edit') }));
    expect(chips()?.closest('[data-held-chips]')?.hasAttribute('inert')).toBe(true);
  });

  it('draws them working once the catch-up gives the role back, in the same place', () => {
    draw(plan());
    expect(chips()).not.toBeNull();
    expect(document.querySelector('[data-held-chips]')).toBeNull();
  });

  it("keeps a Participant's chips", () => {
    draw(plan({ ...VIEWER, warmRights: warmRightsOf('participate') }));
    expect(chips()?.closest('[data-held-chips]')).not.toBeNull();
  });

  it("leaves no gap for a Viewer's copy", () => {
    draw(plan({ ...VIEWER, warmRights: warmRightsOf('view') }));
    expect(chips()).toBeNull();
  });
});
