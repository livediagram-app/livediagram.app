// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { ITEM_TYPES } from '@livediagram/items';
import { usePlanSlice } from './usePlanSlice';

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
});
