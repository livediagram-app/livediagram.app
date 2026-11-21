// @vitest-environment jsdom
// blueprint automations.md "Editor", "The item": the ItemView keeps its identity through an edit (a new tab list
// with the same ids and names, a new openTab handler), and changes when a name, the tab or the people change; the
// screen's `useItem` adds the Space team's joined members, read once it opens.
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const members = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/team-people', () => ({ apiTeamMembers: members }));

const { SpaceItemContext, peopleOf, useSpaceItemView } = await import('./space-item');
const { useSpaceItem } = await import('./space-people');
type SpaceItemInput = import('./space-item').SpaceItemInput;
type SpaceItem = import('./space-item').SpaceItem;

// A block, not the mock: a function beforeEach answers is run as its teardown.
beforeEach(() => {
  members.mockReset();
});

const base = (over: Partial<SpaceItemInput> = {}): SpaceItemInput => ({
  documentId: 'doc1',
  documentName: 'Studio Office',
  // A tab carries far more than rules read; an edit gives it, and the list, a new identity.
  tabs: [
    { id: 't1', name: 'Lobby', elements: [1] } as { id: string; name: string },
    { id: 't2', name: 'Meeting Room' },
  ],
  activeId: 't1',
  self: { id: 'user_me', name: 'Me' },
  shareCode: null,
  openTab: () => {},
  ...over,
});

describe('useSpaceItemView', () => {
  it('answers the same view through an edit', () => {
    const { result, rerender } = renderHook((input: SpaceItemInput) => useSpaceItemView(input), {
      initialProps: base(),
    });
    const first = result.current;
    rerender(
      base({
        tabs: [
          { id: 't1', name: 'Lobby', elements: [1, 2] } as { id: string; name: string },
          { id: 't2', name: 'Meeting Room' },
        ],
        self: { id: 'user_me', name: 'Me' },
        openTab: () => {},
      }),
    );
    expect(result.current).toBe(first);
    expect(result.current!.tabs).toEqual([
      { id: 't1', name: 'Lobby' },
      { id: 't2', name: 'Meeting Room' },
    ]);
    expect(result.current!.people).toEqual([{ id: 'user_me', name: 'Me' }]);
  });

  it('answers a new view when a tab is renamed, another opened, or the name changes', () => {
    const { result, rerender } = renderHook((input: SpaceItemInput) => useSpaceItemView(input), {
      initialProps: base(),
    });
    const first = result.current;
    rerender(base({ tabs: [{ id: 't1', name: 'Front Desk' }] }));
    expect(result.current).not.toBe(first);
    const second = result.current;
    rerender(base({ tabs: [{ id: 't1', name: 'Front Desk' }], activeId: 't2' }));
    expect(result.current).not.toBe(second);
    expect(result.current!.currentTabId).toBe('t2');
    rerender(base({ documentName: '  ' }));
    expect(result.current!.name).toBe('Untitled Space');
  });

  it('opens a tab through the newest handler', () => {
    const one = vi.fn();
    const two = vi.fn();
    const { result, rerender } = renderHook((input: SpaceItemInput) => useSpaceItemView(input), {
      initialProps: base({ openTab: one }),
    });
    rerender(base({ openTab: two }));
    result.current!.openTab('t2');
    expect(one).not.toHaveBeenCalled();
    expect(two).toHaveBeenCalledWith('t2');
  });

  it('is null without a Space, and signed out for a guest', () => {
    const { result, rerender } = renderHook((input: SpaceItemInput) => useSpaceItemView(input), {
      initialProps: base({ documentId: null }),
    });
    expect(result.current).toBeNull();
    rerender(base({ self: null }));
    expect(result.current!.signedIn).toBe(false);
    expect(result.current!.people).toEqual([]);
  });
});

describe('peopleOf', () => {
  it('names the account first, then each joined member once, never an invite', () => {
    expect(
      peopleOf({ id: 'u1', name: 'Me' }, [
        { userId: 'u2', name: 'Ana' },
        { userId: 'u1', name: 'Me again' },
        { userId: null, name: 'Guest' },
        { userId: 'u3', name: 'Invited', pending: true },
        { userId: 'u2', name: 'Ana twice' },
      ]),
    ).toEqual([
      { id: 'u1', name: 'Me' },
      { id: 'u2', name: 'Ana' },
    ]);
    expect(peopleOf(null, [])).toEqual([]);
  });
});

// The view the host provides, as the editor view works it out.
function provided(team: SpaceItem['team']): SpaceItem {
  const view = renderHook(() => useSpaceItemView(base())).result.current;
  return { view, team };
}
const wrap = (value: SpaceItem) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return <SpaceItemContext value={value}>{children}</SpaceItemContext>;
  };

const TEAM = { ownerId: 'user_me', team: { id: 'team1', name: 'Studio' } };
const member = (id: string, userId: string | null, name: string, status = 'joined') => ({
  id,
  userId,
  name,
  email: `${id}@example.com`,
  status,
  role: 'member',
});

describe('useSpaceItem', () => {
  it('adds the team’s joined members once read, after the account', async () => {
    members.mockResolvedValue([
      member('m1', 'user_me', 'Me'),
      member('m2', 'user_ana', 'Ana Costa'),
      member('m3', null, '', 'invited'),
    ]);
    const value = provided(TEAM);
    const { result } = renderHook(() => useSpaceItem(), { wrapper: wrap(value) });
    // The host's view itself until the team adds someone.
    expect(result.current).toBe(value.view);
    await waitFor(() =>
      expect(result.current.people).toEqual([
        { id: 'user_me', name: 'Me' },
        { id: 'user_ana', name: 'Ana Costa' },
      ]),
    );
    expect(members).toHaveBeenCalledExactlyOnceWith('user_me', 'team1');
    expect(result.current.tabs).toBe(value.view!.tabs);
  });

  it('reads nothing for a personal Space, and keeps the account alone on a failed read', async () => {
    const personal = provided(null);
    const { result } = renderHook(() => useSpaceItem(), { wrapper: wrap(personal) });
    expect(result.current).toBe(personal.view);
    expect(members).not.toHaveBeenCalled();

    members.mockRejectedValue(new Error('offline'));
    const teamed = provided(TEAM);
    const failed = renderHook(() => useSpaceItem(), { wrapper: wrap(teamed) });
    expect(members).toHaveBeenCalledOnce();
    // The read settles, and the account stays alone.
    await act(async () => {});
    expect(failed.result.current).toBe(teamed.view);
  });

  it('draws an empty Space with no view', () => {
    const { result } = renderHook(() => useSpaceItem(), {
      wrapper: wrap({ view: null, team: null }),
    });
    expect(result.current.id).toBe('');
    expect(result.current.people).toEqual([]);
  });
});
