// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Element, ElementAction, Tab } from '@livepages/document';
import {
  EMPTY_ITEM_STORE,
  LINKED_AT_FIELD,
  LINKED_FIELD,
  LINKED_REV_FIELD,
  itemPersonId,
  linkedCardId,
  type Item,
  type ItemStoreState,
  type ItemWrite,
} from '@livepages/items';
import { actionsBoardIn } from './linked-actions';
import { LINKED_HEAL_DEBOUNCE_MS, useLinkedActionCards } from './useLinkedActionCards';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

// docs/specs/026-plan/linked-boards.md: the Actions board in the editor.
const action = (id: string, over: Partial<ElementAction> = {}): ElementAction => ({
  id,
  name: `Action ${id}`,
  description: '',
  assignee: { userId: null, name: null },
  teamId: null,
  assignerId: 'u1',
  assignerName: 'Sam',
  status: 'open',
  createdAt: 1,
  updatedAt: 100,
  ...over,
});
const shape = (id: string, extra: Record<string, unknown> = {}) =>
  ({
    id,
    type: 'shape',
    shape: 'rectangle',
    x: 0,
    y: 0,
    width: 100,
    height: 60,
    ...extra,
  }) as unknown as Element;
const boardEl = shape('b1', {
  shape: 'plan-board',
  planBoard: {
    title: 'Actions',
    columns: [
      { id: 'new', status: 'new', name: 'New' },
      { id: 'done', status: 'done', name: 'Done' },
      { id: 'wont', status: 'wont-do', name: 'Won’t Do' },
    ],
    doneColumnId: 'done',
    swimlaneBy: 'none',
    cardFields: [],
    hideWriting: false,
    collects: 'actions',
  },
});
const canvas = (actions: ElementAction[]): Tab => ({
  id: 't1',
  name: 'Retro',
  elements: [shape('p1', { shape: 'action-card', actions })],
});
const boardTab: Tab = { id: 'tb', name: 'Actions', elements: [boardEl], kind: 'board' };
const by = { id: 'x', name: 'X', color: '#000000' };
const cardFor = (
  a: ElementAction,
  fields: Item['fields'] = {},
  over: Partial<Item> = {},
): Item => ({
  id: linkedCardId('actions', a.id),
  type: 'action',
  key: 1,
  rank: 'a0',
  fields: {
    title: a.name,
    status: 'new',
    [LINKED_FIELD]: `actions/t1/p1/${a.id}`,
    [LINKED_AT_FIELD]: a.updatedAt,
    [LINKED_REV_FIELD]: 1,
    ...fields,
  },
  rev: 1,
  createdAt: 1,
  updatedAt: 1,
  createdBy: by,
  updatedBy: by,
  ...over,
});

function setUp(initial: {
  tabs: Tab[];
  items?: Item[];
  canMakeBoard?: boolean;
  canHeal?: boolean;
  unloaded?: string[];
}) {
  let tabs = initial.tabs;
  const store = (list: Item[]): ItemStoreState => ({ ...EMPTY_ITEM_STORE, items: list });
  const spies = {
    writeQuiet: vi.fn(async (_w: ItemWrite, _o?: { silent?: boolean }) => true),
    commitTabs: vi.fn((fn: (ts: Tab[]) => Tab[]) => {
      tabs = fn(tabs);
    }),
    tickTabs: vi.fn((fn: (ts: Tab[]) => Tab[]) => {
      tabs = fn(tabs);
    }),
    markTabLoaded: vi.fn(),
    bringCardTypes: vi.fn(),
    loadTabs: vi.fn(async () => {}),
    arrive: vi.fn(),
    announceBoard: vi.fn(),
  };
  const props = (list: Item[]) => {
    const s = store(list);
    return {
      tabs,
      loadedTabIds: new Set(tabs.map((t) => t.id).filter((id) => !initial.unloaded?.includes(id))),
      board: actionsBoardIn(tabs),
      items: {
        store: s,
        items: new Map(list.map((i) => [i.id, i])),
        status: 'ready' as const,
        writeQuiet: spies.writeQuiet,
      },
      canHeal: initial.canHeal ?? true,
      canMakeBoard: initial.canMakeBoard ?? true,
      statusNames: new Map<string, string>(),
      ...spies,
    };
  };
  const hook = renderHook((p: ReturnType<typeof props>) => useLinkedActionCards(p), {
    initialProps: props(initial.items ?? []),
  });
  return {
    ...hook,
    spies,
    tabs: () => tabs,
    rerenderWith: (list: Item[]) => hook.rerender(props(list)),
  };
}

const settle = async () => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(LINKED_HEAL_DEBOUNCE_MS + 10);
  });
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useLinkedActionCards', () => {
  it('makes the Actions board on the first action, once, and says so', async () => {
    const h = setUp({ tabs: [canvas([action('a1')])] });
    await act(async () => {
      h.result.current.noteActionAdded('t1');
      await Promise.resolve();
    });
    const made = h.tabs()[1]!;
    expect(made).toMatchObject({ name: 'Actions', kind: 'board' });
    expect(actionsBoardIn(h.tabs())?.tabId).toBe(made.id);
    expect(h.spies.markTabLoaded).toHaveBeenCalledWith(made.id);
    expect(h.spies.bringCardTypes).toHaveBeenCalledWith(made.elements);
    expect(h.spies.announceBoard).toHaveBeenCalledWith(
      'Added to Your Actions Board',
      expect.any(Function),
    );
    const open = h.spies.announceBoard.mock.calls[0]![1] as () => void;
    open();
    expect(h.spies.arrive).toHaveBeenCalledWith({
      at: { tabId: made.id, elementId: made.elements[0]!.id },
      open: null,
      itemId: null,
    });
    // A second ask on the same document adds nothing.
    await act(async () => {
      h.result.current.noteActionAdded('t1');
      await Promise.resolve();
    });
    expect(h.tabs()).toHaveLength(2);
  });

  it('finishes making the board when the commit applies later, as React applies it', async () => {
    const h = setUp({ tabs: [canvas([action('a1')])] });
    const queued: ((ts: Tab[]) => Tab[])[] = [];
    h.spies.commitTabs.mockImplementation((fn) => {
      queued.push(fn);
    });
    await act(async () => {
      h.result.current.noteActionAdded('t1');
      await Promise.resolve();
    });
    expect(queued).toHaveLength(1);
    expect(h.spies.markTabLoaded).toHaveBeenCalledOnce();
    expect(h.spies.bringCardTypes).toHaveBeenCalledOnce();
    expect(h.spies.announceBoard).toHaveBeenCalledOnce();
  });

  it('reads unopened tabs before deciding there is no board', async () => {
    const h = setUp({
      tabs: [canvas([action('a1')]), { id: 'tb', name: 'Actions', elements: [], kind: 'board' }],
      unloaded: ['tb'],
    });
    // The hook's own read of Board tabs, for a document that has actions.
    expect(h.spies.loadTabs).toHaveBeenCalledWith(['tb']);
  });

  it('never makes a board for a session that may not', async () => {
    const h = setUp({ tabs: [canvas([action('a1')])], canMakeBoard: false });
    await act(async () => {
      h.result.current.noteActionAdded('t1');
      await Promise.resolve();
    });
    expect(h.tabs()).toHaveLength(1);
  });

  it('heals: makes a card for an action with none, quietly and silently', async () => {
    const h = setUp({ tabs: [canvas([action('a1')]), boardTab] });
    await settle();
    expect(h.spies.writeQuiet).toHaveBeenCalledWith(
      {
        kind: 'create',
        creates: [expect.objectContaining({ id: linkedCardId('actions', 'a1'), type: 'action' })],
      },
      { silent: true },
    );
  });

  it('waits for an assignee to be named as Plan names people, then gives the card that person', async () => {
    const sam = action('a1', { assignee: { userId: 'u-sam', name: 'Sam' } });
    const h = setUp({ tabs: [canvas([sam]), boardTab] });
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    h.rerenderWith([]);
    await settle();
    // The person id is a SHA-256 (itemPersonId) that resolves on a real thread, not on the fake
    // clock, so on a busy runner the card is written after one settle: wait for it, advancing time.
    const personId = await itemPersonId('u-sam');
    await vi.waitFor(() => {
      const create = h.spies.writeQuiet.mock.calls.find(([w]) => w.kind === 'create')?.[0];
      expect(create).toMatchObject({
        creates: [{ fields: { assignee: { id: personId, name: 'Sam' } } }],
      });
    });
  });

  it('heals nothing for a session that may not', async () => {
    const h = setUp({ tabs: [canvas([action('a1')]), boardTab], canHeal: false });
    await settle();
    expect(h.spies.writeQuiet).not.toHaveBeenCalled();
  });

  it('heals: a card moved on the board changes its action on the canvas', async () => {
    const a = action('a1');
    const h = setUp({
      tabs: [canvas([a]), boardTab],
      items: [cardFor(a, { status: 'wont-do' }, { rev: 2, updatedAt: 500 })],
    });
    await settle();
    const p1 = h.tabs()[0]!.elements[0] as unknown as { actions: ElementAction[] };
    expect(p1.actions[0]!.status).toBe('wont-do');
  });

  it('takes an action off the canvas with its trashed card, and puts it back when the card returns', async () => {
    const a = action('a1');
    const card = cardFor(a);
    const h = setUp({ tabs: [canvas([a]), boardTab], items: [card] });
    act(() =>
      h.result.current.noteOwnWrite(
        { kind: 'patch', id: card.id, patch: { set: { status: 'trash', trashedFrom: 'new' } } },
        { ...EMPTY_ITEM_STORE, items: [card] },
      ),
    );
    const panelNow = () => h.tabs()[0]!.elements[0] as unknown as { actions: ElementAction[] };
    expect(panelNow().actions).toEqual([]);
    // The card went to the Trash: the gone action trashes nothing more.
    h.rerenderWith([cardFor(a, { status: 'trash' })]);
    await settle();
    expect(h.spies.writeQuiet).not.toHaveBeenCalled();
    // Restored (an undo): the action comes back.
    h.rerenderWith([card]);
    await settle();
    expect(panelNow().actions.map((x) => x.id)).toEqual(['a1']);
  });

  it('keeps the card of an action that went on the board, as a card of its own', async () => {
    const a = action('a1');
    const h = setUp({ tabs: [canvas([a]), boardTab], items: [cardFor(a)] });
    act(() =>
      h.spies.tickTabs((ts) => ts.map((t) => (t.id === 't1' ? { ...t, elements: [] } : t))),
    );
    h.rerenderWith([cardFor(a)]);
    await act(async () => {
      await Promise.resolve();
    });
    expect(h.spies.writeQuiet).toHaveBeenCalledWith(
      {
        kind: 'patches',
        patches: [
          {
            id: linkedCardId('actions', 'a1'),
            patch: { clear: ['linked', 'linkedAt', 'linkedRev'] },
          },
        ],
      },
      { silent: true },
    );
  });

  it('opens the board on a card, and the canvas at an action', () => {
    const a = action('a1');
    const h = setUp({ tabs: [canvas([a]), boardTab], items: [cardFor(a)] });
    h.result.current.openOnBoard?.('a1');
    expect(h.spies.arrive).toHaveBeenLastCalledWith({
      at: { tabId: 'tb', elementId: 'b1' },
      open: null,
      itemId: linkedCardId('actions', 'a1'),
    });
    h.result.current.showOnCanvas(cardFor(a));
    expect(h.spies.arrive).toHaveBeenLastCalledWith({
      at: { tabId: 't1', elementId: 'p1' },
      open: 'action',
      itemId: null,
    });
    expect(h.result.current.placeOf(cardFor(a))).toEqual({ tabName: 'Retro' });
    expect(h.result.current.placeOf({ ...cardFor(a), fields: {} })).toBeNull();
  });

  it('offers no board link without a board', () => {
    const h = setUp({ tabs: [canvas([action('a1')])] });
    expect(h.result.current.openOnBoard).toBeNull();
  });
});
