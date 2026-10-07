// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { ITEM_TYPES } from '@livediagram/items';
import type { Element } from '@livediagram/document';
import { usePlanSlice } from './usePlanSlice';
import { registerPlanBoardTarget, type PlanBoardTarget } from './plan-board-targets';

// docs/specs/026-plan/plan-mode.md "Cost": the Plan context keeps its identity across editor renders
// that change nothing Plan holds, so boards and cards are not re-rendered by every canvas change.
describe('usePlanSlice', () => {
  const planItems = {
    items: new Map(),
    status: 'ready',
    self: null,
    refetch: vi.fn(),
    write: vi.fn(),
  } as never;
  const itemTypes = { types: ITEM_TYPES } as never;
  const presence = new Map();
  const participants: never[] = [];
  const statusNames = new Map<string, string>();

  it('keeps the context while the editor hands over fresh callbacks', () => {
    const { result, rerender } = renderHook(() =>
      usePlanSlice({
        planItems,
        itemTypes,
        editorMode: 'plan',
        canEdit: true,
        canVote: true,
        teamPeople: participants,
        presence,
        statusNames,
        // Fresh every render, as the editor's are.
        commit: () => {},
        select: () => {},
        announce: () => {},
        publishPresence: () => {},
        addItemSlide: () => {},
      }),
    );
    const first = result.current.context;
    rerender();
    rerender();
    expect(result.current.context).toBe(first);
  });

  it('calls the latest callback the editor handed over', () => {
    const commits: string[] = [];
    let tag = 'a';
    const { result, rerender } = renderHook(() =>
      usePlanSlice({
        planItems,
        itemTypes,
        editorMode: 'plan',
        canEdit: true,
        canVote: true,
        teamPeople: participants,
        presence,
        statusNames,
        commit: () => commits.push(tag),
        select: () => {},
        announce: () => {},
      }),
    );
    tag = 'b';
    rerender();
    result.current.context.removeCard('x');
    expect(commits).toEqual(['b']);
  });

  it('hands a board to the latest slide callback, and offers none without a deck', () => {
    const added: string[] = [];
    const base = {
      planItems,
      itemTypes,
      editorMode: 'plan' as const,
      canEdit: true,
      canVote: true,
      teamPeople: participants,
      presence,
      statusNames,
      commit: () => {},
      select: () => {},
      announce: () => {},
    };
    const { result } = renderHook(() =>
      usePlanSlice({
        ...base,
        addItemSlide: () => {},
        addBoardSlide: (id) => added.push(id),
      }),
    );
    result.current.context.addBoardSlide?.('board');
    expect(added).toEqual(['board']);
    const bare = renderHook(() => usePlanSlice(base));
    expect(bare.result.current.context.addBoardSlide).toBeUndefined();
  });

  // docs/specs/026-plan/items.md "Comments": a card's comment change goes to the item store.
  it('hands a comment change and the owner id to the item store', () => {
    const comment = vi.fn(async () => true);
    const { result } = renderHook(() =>
      usePlanSlice({
        planItems: { ...(planItems as object), comment, ownerId: 'owner-me' } as never,
        itemTypes,
        editorMode: 'plan',
        canEdit: true,
        canVote: true,
        teamPeople: participants,
        presence,
        statusNames,
        commit: () => {},
        select: () => {},
        announce: () => {},
      }),
    );
    result.current.context.commentItem('item-one', { kind: 'add', text: 'Hi' });
    expect(comment).toHaveBeenCalledWith('item-one', { kind: 'add', text: 'Hi' });
    expect(result.current.context.ownerId).toBe('owner-me');
  });

  // docs/specs/026-plan/plan-board.md "Breadcrumb": a card opened from inside the panel steps the trail; one
  // opened any other way starts it afresh.
  it('steps the card trail from inside the panel and restarts it from a board', () => {
    const { result } = renderHook(() =>
      usePlanSlice({
        planItems,
        itemTypes,
        editorMode: 'plan',
        canEdit: true,
        canVote: true,
        teamPeople: participants,
        presence,
        statusNames,
        commit: () => {},
        select: () => {},
        announce: () => {},
      }),
    );
    act(() => result.current.context.openItem('task'));
    act(() => result.current.context.openItem('project', 'Parent'));
    act(() => result.current.context.openItem('sibling', 'ChildCard'));
    expect(result.current.itemTrail).toEqual(['task', 'project', 'sibling']);
    act(() => result.current.context.openItem('task', 'Breadcrumb'));
    expect(result.current.itemTrail).toEqual(['task']);
    act(() => result.current.context.openItem('project', 'Parent'));
    act(() => result.current.context.openItem('elsewhere'));
    expect(result.current.itemTrail).toEqual(['elsewhere']);
    expect(result.current.openItemId).toBe('elsewhere');
  });

  // docs/specs/026-plan/plan-board.md "Open an item": a card this person just made opens with its title
  // selected; any other open (a click, a remote card, a crumb) is not fresh.
  it('opens a card just made as fresh, and any other open as not', () => {
    const { result } = renderHook(() =>
      usePlanSlice({
        planItems,
        itemTypes,
        editorMode: 'plan',
        canEdit: true,
        canVote: true,
        teamPeople: participants,
        presence,
        statusNames,
        commit: () => {},
        select: () => {},
        announce: () => {},
      }),
    );
    act(() => result.current.context.openNewItem('made'));
    expect(result.current.openItemId).toBe('made');
    expect(result.current.freshItemId).toBe('made');
    act(() => result.current.context.openItem('other'));
    expect(result.current.freshItemId).toBeNull();
    act(() => result.current.context.openNewItem('made-2'));
    act(() => result.current.closeItem());
    expect(result.current.openItemId).toBeNull();
    expect(result.current.freshItemId).toBeNull();
  });
});

// docs/specs/026-plan/plan-board.md "Working on a board" and item-types.md "An item type": a canvas Plan card dropped
// on a board is checked before it moves, and leaves the canvas only once the move has landed.
describe('a canvas Plan card dropped on a board', () => {
  const types = ITEM_TYPES.map((t) => (t.id === 'task' ? { ...t, excludedStatuses: ['done'] } : t));
  const cardEl = { id: 'el-1', type: 'shape', shape: 'plan-card', planCard: { itemId: 'i1' } };
  function slice(status: string, ok = true) {
    const write = vi.fn(async () => ok);
    const commit = vi.fn();
    const announce = vi.fn();
    const notify = vi.fn();
    const items = new Map([['i1', { id: 'i1', type: 'task', fields: { title: 'T', status } }]]);
    const { result } = renderHook(() =>
      usePlanSlice({
        planItems: { items, status: 'ready', self: null, refetch: vi.fn(), write } as never,
        itemTypes: { types } as never,
        editorMode: 'plan',
        canEdit: true,
        canVote: true,
        teamPeople: [],
        presence: new Map(),
        statusNames: new Map([['done', 'Done']]),
        commit,
        select: () => {},
        announce,
        notify,
      }),
    );
    return { result, write, commit, announce, notify };
  }

  it('refuses a status the card’s type leaves out: nothing moves, the card goes back, it is said', () => {
    const { result, write, commit, notify } = slice('todo');
    let answer: string | undefined;
    act(() => {
      answer = result.current.dropPlanCardOnBoard(cardEl as unknown as Element, 'done');
    });
    // 'refused': the drag puts the canvas card back where it started.
    expect(answer).toBe('refused');
    expect(write).not.toHaveBeenCalled();
    expect(commit).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith("Task cards can't be Done");
  });

  it('refuses a board that does not show the card’s type', () => {
    const target = {
      accepts: () => false,
      refusal: () => 'This board shows Bug cards',
    } as unknown as PlanBoardTarget;
    const off = registerPlanBoardTarget('board-1', target);
    const { result, write, commit, notify } = slice('todo');
    let answer: string | undefined;
    act(() => {
      answer = result.current.dropPlanCardOnBoard(cardEl as unknown as Element, 'doing', 'board-1');
    });
    expect(answer).toBe('refused');
    expect(write).not.toHaveBeenCalled();
    expect(commit).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith('This board shows Bug cards');
    off();
  });

  it('moves the item, then takes the canvas card away', async () => {
    const { result, write, commit } = slice('todo');
    let answer: string | undefined = 'unset';
    await act(async () => {
      answer = result.current.dropPlanCardOnBoard(cardEl as unknown as Element, 'doing');
    });
    expect(answer).toBeUndefined();
    expect(write).toHaveBeenCalledWith({
      kind: 'move',
      id: 'i1',
      move: { status: 'doing', before: null },
    });
    expect(commit).toHaveBeenCalledOnce();
  });

  it('keeps the canvas card when the move fails', async () => {
    const { result, write, commit } = slice('todo', false);
    await act(async () =>
      result.current.dropPlanCardOnBoard(cardEl as unknown as Element, 'doing'),
    );
    expect(write).toHaveBeenCalled();
    expect(commit).not.toHaveBeenCalled();
  });
});
