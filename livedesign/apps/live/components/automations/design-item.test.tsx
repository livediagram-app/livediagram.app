// @vitest-environment jsdom
// blueprint automations.md "Editor", "The item": the ItemView keeps its identity through an edit (a new tab
// list with the same ids and names, a new openTab handler), and changes when a name, the tab or the people change.
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { peopleOf, useDesignItemView, type DesignItemInput } from './design-item';

const base = (over: Partial<DesignItemInput> = {}): DesignItemInput => ({
  designId: 'd1',
  designName: 'Brand',
  // A tab carries far more than rules read; an edit gives it, and the list, a new identity.
  tabs: [
    { id: 't1', name: 'Logo', elements: [1] } as { id: string; name: string },
    { id: 't2', name: 'Notes' },
  ],
  activeId: 't1',
  self: { id: 'user_me', name: 'Me' },
  team: [{ userId: 'user_ana', name: 'Ana' }],
  shareCode: null,
  openTab: () => {},
  ...over,
});

describe('useDesignItemView', () => {
  it('answers the same view through an edit', () => {
    const { result, rerender } = renderHook((input: DesignItemInput) => useDesignItemView(input), {
      initialProps: base(),
    });
    const first = result.current;
    rerender(
      base({
        tabs: [
          { id: 't1', name: 'Logo', elements: [1, 2] } as { id: string; name: string },
          { id: 't2', name: 'Notes' },
        ],
        team: [{ userId: 'user_ana', name: 'Ana' }],
        self: { id: 'user_me', name: 'Me' },
        openTab: () => {},
      }),
    );
    expect(result.current).toBe(first);
    expect(result.current!.tabs).toEqual([
      { id: 't1', name: 'Logo' },
      { id: 't2', name: 'Notes' },
    ]);
  });

  it('answers a new view when a tab is renamed, another opened, or the name changes', () => {
    const { result, rerender } = renderHook((input: DesignItemInput) => useDesignItemView(input), {
      initialProps: base(),
    });
    const first = result.current;
    rerender(base({ tabs: [{ id: 't1', name: 'Logo 2' }] }));
    expect(result.current).not.toBe(first);
    const second = result.current;
    rerender(base({ tabs: [{ id: 't1', name: 'Logo 2' }], activeId: 't2' }));
    expect(result.current).not.toBe(second);
    expect(result.current!.currentTabId).toBe('t2');
    rerender(base({ designName: '  ' }));
    expect(result.current!.name).toBe('Untitled design');
  });

  it('opens a tab through the newest handler', () => {
    const one = vi.fn();
    const two = vi.fn();
    const { result, rerender } = renderHook((input: DesignItemInput) => useDesignItemView(input), {
      initialProps: base({ openTab: one }),
    });
    rerender(base({ openTab: two }));
    result.current!.openTab('t2');
    expect(one).not.toHaveBeenCalled();
    expect(two).toHaveBeenCalledWith('t2');
  });

  it('is null without a design, and signed out for a guest', () => {
    const { result, rerender } = renderHook((input: DesignItemInput) => useDesignItemView(input), {
      initialProps: base({ designId: null }),
    });
    expect(result.current).toBeNull();
    rerender(base({ self: null }));
    expect(result.current!.signedIn).toBe(false);
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
