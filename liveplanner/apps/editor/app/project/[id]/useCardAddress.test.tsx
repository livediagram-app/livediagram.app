// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import type { MutableRefObject } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CARD_ENTRY_KEY } from '@/lib/card-address';
import { useCardAddress } from './useCardAddress';

// docs/specs/026-plan/plan-board.md "Its address": the open card rides in the address; opening it from the plan adds
// one entry, so Back closes it; arriving by its address, or moving card to card, adds none.
type Props = {
  hydrated: boolean;
  activeId: string | null;
  shownId: string | null;
  openItemId: string | null;
};

function setup(initial: Partial<Props> = {}) {
  const arrivingRef: MutableRefObject<string | null> = { current: null };
  const openItem = vi.fn();
  const closeItem = vi.fn();
  const props: Props = {
    hydrated: true,
    activeId: 't1',
    shownId: null,
    openItemId: null,
    ...initial,
  };
  const hook = renderHook(
    (p: Props) => useCardAddress({ ...p, arrivingRef, openItem, closeItem }),
    {
      initialProps: props,
    },
  );
  const show = (id: string | null) => hook.rerender({ ...props, shownId: id, openItemId: id });
  return { ...hook, arrivingRef, openItem, closeItem, show, props };
}

const popTo = (path: string) =>
  act(() => {
    window.history.replaceState(null, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  });

beforeEach(() => window.history.replaceState(null, '', '/project/p1#t=t1'));
afterEach(() => {
  vi.restoreAllMocks();
  window.history.replaceState(null, '', '/');
});

describe('useCardAddress', () => {
  it('pushes a marked entry for a card opened from the plan', () => {
    const push = vi.spyOn(window.history, 'pushState');
    const { show } = setup();
    show('it-1');
    expect(push).toHaveBeenCalledOnce();
    expect(window.location.hash).toBe('#t=t1&item=it-1');
    expect(window.history.state).toEqual({ [CARD_ENTRY_KEY]: true });
  });

  it('steps back off the card’s entry when the card closes', () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
    const { show } = setup();
    show('it-1');
    show(null);
    expect(back).toHaveBeenCalledOnce();
  });

  it('replaces when a card closes on an entry it did not add', () => {
    const back = vi.spyOn(window.history, 'back');
    window.history.replaceState(null, '', '/project/p1#t=t1&item=it-1');
    const { show } = setup({ shownId: 'it-1', openItemId: 'it-1' });
    show(null);
    expect(back).not.toHaveBeenCalled();
    expect(window.location.hash).toBe('#t=t1');
  });

  it('replaces for a card arriving by its address, and for a move from card to card', () => {
    const push = vi.spyOn(window.history, 'pushState');
    const { show, arrivingRef } = setup();
    arrivingRef.current = 'it-1';
    show('it-1');
    expect(push).not.toHaveBeenCalled();
    expect(arrivingRef.current).toBeNull();
    expect(window.location.hash).toBe('#t=t1&item=it-1');
    show('it-2');
    expect(push).not.toHaveBeenCalled();
    expect(window.location.hash).toBe('#t=t1&item=it-2');
  });

  it('keeps the card’s mark while moving from card to card', () => {
    const { show } = setup();
    show('it-1');
    show('it-2');
    expect(window.history.state).toEqual({ [CARD_ENTRY_KEY]: true });
  });

  it('writes nothing until hydrated, for no tab, or off the editor’s own path', () => {
    const replace = vi.spyOn(window.history, 'replaceState');
    const cold = setup({ hydrated: false, shownId: 'it-1', openItemId: 'it-1' });
    cold.unmount();
    const noTab = setup({ activeId: null, shownId: 'it-1', openItemId: 'it-1' });
    noTab.unmount();
    expect(replace).not.toHaveBeenCalled();
    window.history.replaceState(null, '', '/embed/workbench/project/p1');
    replace.mockClear();
    setup({ shownId: 'it-1', openItemId: 'it-1' });
    expect(replace).not.toHaveBeenCalled();
    expect(window.location.hash).toBe('');
  });

  it('leaves an address that already says the right thing alone', () => {
    const replace = vi.spyOn(window.history, 'replaceState');
    setup();
    expect(replace).not.toHaveBeenCalled();
  });

  it('closes the card on Back, and opens it again, as an arrival, on Forward', () => {
    const { closeItem, openItem, arrivingRef, rerender, props } = setup({
      shownId: 'it-1',
      openItemId: 'it-1',
    });
    popTo('/project/p1#t=t1');
    expect(closeItem).toHaveBeenCalledOnce();
    rerender({ ...props, shownId: null, openItemId: null });
    popTo('/project/p1#t=t1&item=it-1');
    expect(openItem).toHaveBeenCalledWith('it-1');
    expect(arrivingRef.current).toBe('it-1');
  });

  it('ignores a pop that changes no card, or lands off the editor', () => {
    const { closeItem, openItem } = setup({ shownId: 'it-1', openItemId: 'it-1' });
    popTo('/project/p1#t=t2&item=it-1');
    popTo('/explorer/mine');
    expect(closeItem).not.toHaveBeenCalled();
    expect(openItem).not.toHaveBeenCalled();
  });

  it('listens only once hydrated, and stops when unmounted', () => {
    const cold = setup({ hydrated: false, openItemId: 'it-1' });
    popTo('/project/p1#t=t1');
    expect(cold.closeItem).not.toHaveBeenCalled();
    cold.unmount();
    const warm = setup({ openItemId: 'it-1' });
    warm.unmount();
    popTo('/project/p1#t=t1');
    expect(warm.closeItem).not.toHaveBeenCalled();
  });
});
