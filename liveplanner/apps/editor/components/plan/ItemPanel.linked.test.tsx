// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ITEM_TYPES,
  type CustomFieldDef,
  type Item,
  type ItemTypeDef,
  type LinkedGroup,
} from '@liveplanner/items';
import { ItemPanel } from './ItemPanel';
import { PlanProvider, type PlanContextValue } from './PlanContext';
import { linkedCardCount } from './LinkedCardsTab';
import { LINKED_TAB, panelTabs } from './ItemPanelTabs';

// docs/specs/026-plan/item-types.md "The Linked Cards tab": the Linked as sections leave the type's first tab for a
// generated Linked Cards tab after the type's own, shown only when a Card field can link to the type, with a count
// and an empty state; Blocked By stays on the first tab; a type's own Linked Cards tab takes them instead.

const viewport = vi.hoisted(() => ({ mobile: false }));
vi.mock('@liveworkspace/workbench/hooks/ui/useIsMobileViewport', () => ({
  useIsMobileViewport: () => viewport.mobile,
}));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

afterEach(() => {
  cleanup();
  viewport.mobile = false;
});

const PERSON = { id: 'p', name: 'Sam', color: '#2563eb' };
const item = (id: string, key: number, type: string, fields: Item['fields'] = {}): Item => ({
  id,
  type,
  key,
  rank: 'i',
  fields: { title: `Card ${key}`, ...fields },
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: PERSON,
  updatedBy: PERSON,
});

const PROJECT = item('p', 1, 'project');
const parentGroup = (cards: Item[]): LinkedGroup => ({
  fieldId: 'parent',
  label: 'Parent',
  fromTypes: ['task'],
  cards,
});
const ownerGroup = (cards: Item[]): LinkedGroup => ({
  fieldId: 'f-owner',
  label: 'Owner',
  fromTypes: ['task'],
  cards,
});

type Options = {
  types?: readonly ItemTypeDef[];
  groups?: readonly LinkedGroup[];
  canEdit?: boolean;
  plan?: PlanContextValue;
};

function props(open: Item, { types = ITEM_TYPES, groups = [], canEdit = true }: Options) {
  const noop = vi.fn();
  return {
    item: open,
    types,
    statuses: [],
    people: [],
    labels: [],
    canEdit,
    onSave: noop,
    onPatch: noop,
    onType: noop,
    onOpenItem: vi.fn(),
    onTrash: noop,
    onDuplicate: noop,
    onFlag: noop,
    onArchive: noop,
    onClose: noop,
    trail: [open],
    linkedGroups: groups,
    onAddLinked: vi.fn(),
    onLinkExisting: vi.fn(async () => true),
    statusNames: new Map<string, string>(),
  };
}

function panel(open: Item, options: Options = {}) {
  const p = props(open, options);
  const wrap = (node: ReactNode) =>
    options.plan ? <PlanProvider value={options.plan}>{node}</PlanProvider> : node;
  const view = render(wrap(<ItemPanel {...p} />));
  return {
    ...p,
    rerender: (groups: readonly LinkedGroup[]) =>
      view.rerender(wrap(<ItemPanel {...p} linkedGroups={groups} />)),
  };
}

const tabNames = () =>
  screen.getAllByRole('tab').map((t) => t.getAttribute('aria-label') ?? t.textContent);
const selected = () => screen.getByRole('tab', { selected: true }).textContent;
const linkedHeadings = () => screen.queryAllByRole('heading', { name: /^Linked as/ });

describe('the Linked Cards tab', () => {
  it('follows the type’s own tabs, before Activity, with the count of cards linked here', () => {
    panel(PROJECT, { groups: [parentGroup([item('c', 2, 'task')])] });
    expect(tabNames()).toEqual(['Overview', 'Linked Cards, 1 card', 'Activity']);
    expect(selected()).toBe('Overview');
  });

  it('comes before Activity and Details on a phone', () => {
    viewport.mobile = true;
    panel(PROJECT, { groups: [parentGroup([])] });
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual([
      'Overview',
      'Linked Cards',
      'Activity',
      'Details',
    ]);
  });

  it('is not there on a type nothing can link to', () => {
    panel(item('t', 2, 'task'));
    expect(screen.queryByRole('tab', { name: /Linked Cards/ })).toBeNull();
    expect(linkedHeadings()).toEqual([]);
  });

  it('takes every Linked as section off the first tab, with its cards and buttons', () => {
    const { onAddLinked, onOpenItem } = panel(PROJECT, {
      groups: [parentGroup([item('c', 2, 'task')]), ownerGroup([])],
    });
    // Overview holds the type's own fields only.
    expect(linkedHeadings()).toEqual([]);
    expect(screen.queryByRole('button', { name: /New Task/ })).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: /^Linked Cards/ }));
    expect(linkedHeadings().map((h) => h.textContent)).toEqual([
      'Linked as Parent1',
      'Linked as Owner0',
    ]);
    // Some card links here, so an empty section keeps its own note, and no tab-wide empty state shows.
    expect(screen.getByText('No cards link here as Owner yet.')).toBeTruthy();
    expect(screen.queryByText('No Linked Cards Yet')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^Open #2 Card 2/ }));
    expect(onOpenItem).toHaveBeenCalledWith('c', 'ChildCard');
    fireEvent.click(screen.getAllByRole('button', { name: /New Task/ })[0]!);
    expect(onAddLinked).toHaveBeenCalledWith(
      expect.objectContaining({ fieldId: 'parent' }),
      'task',
    );
    expect(screen.getByRole('button', { name: 'Link an existing card as Owner' })).toBeTruthy();
  });

  it('opens on an empty state with each section’s buttons when nothing links here yet', () => {
    panel(PROJECT, { groups: [parentGroup([]), ownerGroup([])] });
    const tab = screen.getByRole('tab', { name: 'Linked Cards' });
    // No count pill at none.
    expect(tab.textContent).toBe('Linked Cards');
    fireEvent.click(tab);
    expect(screen.getByText('No Linked Cards Yet')).toBeTruthy();
    expect(
      screen.getByText(
        'Cards that link to this one show here. Make one already linked, or link one you already have.',
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/No cards link here as/)).toBeNull();
    expect(linkedHeadings()).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Link an existing card as Parent' })).toBeTruthy();
  });

  it('gives a Viewer the empty state alone', () => {
    panel(PROJECT, { groups: [parentGroup([])], canEdit: false });
    fireEvent.click(screen.getByRole('tab', { name: 'Linked Cards' }));
    expect(screen.getByText('Cards that link to this one show here.')).toBeTruthy();
    expect(linkedHeadings()).toEqual([]);
    expect(screen.queryByRole('button', { name: /New Task|Link an existing/ })).toBeNull();
  });

  it('gives a Viewer the cards, without New or Link Existing', () => {
    panel(PROJECT, { groups: [parentGroup([item('c', 2, 'task')])], canEdit: false });
    fireEvent.click(screen.getByRole('tab', { name: /^Linked Cards/ }));
    expect(screen.getByRole('button', { name: /^Open #2 Card 2/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /New Task|Link an existing/ })).toBeNull();
  });

  it('stays picked as the cards change, and gives way to the first tab once nothing can link here', () => {
    const { rerender } = panel(PROJECT, { groups: [parentGroup([])] });
    fireEvent.click(screen.getByRole('tab', { name: 'Linked Cards' }));
    rerender([parentGroup([item('c', 2, 'task'), item('d', 3, 'task')])]);
    expect(screen.getByRole('tab', { selected: true }).getAttribute('aria-label')).toBe(
      'Linked Cards, 2 cards',
    );
    expect(screen.getAllByRole('button', { name: /^Open #/ })).toHaveLength(2);
    rerender([]);
    expect(selected()).toBe('Overview');
    expect(screen.queryByRole('tab', { name: /Linked Cards/ })).toBeNull();
  });

  it('joins a type’s own tab named Linked Cards rather than adding a second', () => {
    const tabbed: ItemTypeDef = {
      ...ITEM_TYPES.find((t) => t.id === 'project')!,
      tabs: [
        { id: 't-overview', label: 'Overview', fields: ['description'] },
        { id: 't-linked-cards', label: 'linked cards', fields: ['comments'] },
      ],
    };
    panel(PROJECT, {
      types: [tabbed, ...ITEM_TYPES],
      groups: [parentGroup([item('c', 2, 'task')])],
    });
    expect(tabNames()).toEqual(['Overview', 'linked cards, 1 card', 'Activity']);
    fireEvent.click(screen.getByRole('tab', { name: /^linked cards/ }));
    const panelEl = screen.getByRole('tabpanel');
    const heading = within(panelEl).getByRole('heading', { name: /Linked as Parent/ });
    const comments = within(panelEl).getByText('Comments');
    // Before the tab's Comments.
    expect(
      heading.compareDocumentPosition(comments) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});

describe('Blocked By and Blocks', () => {
  const BLOCKED_BY: CustomFieldDef = {
    id: 'f-bb',
    label: 'Blocked By',
    kind: 'card',
    linkType: 'task',
    multiple: true,
    blocks: true,
  };
  const TYPES: ItemTypeDef[] = ITEM_TYPES.map((t) =>
    t.id === 'task'
      ? { ...t, fields: [...t.fields, BLOCKED_BY.id], custom: [...(t.custom ?? []), BLOCKED_BY] }
      : t,
  );
  const blocker = item('b', 1, 'task', { status: 'todo' });
  const open = item('o', 2, 'task', { status: 'todo', [BLOCKED_BY.id]: ['b'] });
  const waiting = item('w', 3, 'task', { status: 'todo', [BLOCKED_BY.id]: ['o'] });
  const plan = {
    items: new Map([blocker, open, waiting].map((i) => [i.id, i])),
    types: TYPES,
    statusPhases: new Map([['todo', 'todo']]),
    statusNames: new Map([['todo', 'To Do']]),
    announce: vi.fn(),
    notify: vi.fn(),
    canEdit: true,
    canEditCards: true,
  } as unknown as PlanContextValue;

  it('keeps Blocked By on the first tab and moves Blocks to Linked Cards', () => {
    const { onOpenItem } = panel(open, {
      types: TYPES,
      plan,
      groups: [
        {
          fieldId: BLOCKED_BY.id,
          label: 'Blocked By',
          fromTypes: ['task'],
          cards: [waiting],
          blocks: true,
        },
      ],
    });
    const first = screen.getByRole('tabpanel');
    expect(within(first).getByRole('heading', { name: /^Blocked By/ })).toBeTruthy();
    expect(within(first).queryByRole('heading', { name: /^Blocks/ })).toBeNull();
    fireEvent.click(within(first).getByRole('button', { name: /^Open #1 Card 1/ }));
    expect(onOpenItem).toHaveBeenCalledWith('b', 'ChildCard');
    fireEvent.click(screen.getByRole('tab', { name: 'Linked Cards, 1 card' }));
    const linked = screen.getByRole('tabpanel');
    expect(within(linked).getByRole('heading', { name: /^Blocks/ })).toBeTruthy();
    expect(within(linked).queryByRole('heading', { name: /^Blocked By/ })).toBeNull();
  });
});

describe('the tab’s parts', () => {
  it('counts a card linked through two fields once', () => {
    const c = item('c', 2, 'task');
    expect(linkedCardCount([parentGroup([c]), ownerGroup([c, item('d', 3, 'task')])])).toBe(2);
    expect(linkedCardCount([])).toBe(0);
  });

  it('adds the generated tab only when asked, carrying its count', () => {
    const own = [{ id: 't-overview', label: 'Overview', fields: [] }];
    expect(panelTabs(own, null).map((t) => t.id)).toEqual(['t-overview', 'card-activity']);
    expect(panelTabs(own, null, 0).find((t) => t.id === LINKED_TAB)?.count).toBe(0);
  });
});
