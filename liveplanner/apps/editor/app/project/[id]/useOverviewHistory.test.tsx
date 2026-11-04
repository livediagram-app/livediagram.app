// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCardAddress } from './useCardAddress';
import { useOverviewHistory } from './useOverviewHistory';
import { useTabEntryEffects } from './useTabEntryEffects';

// docs/specs/026-plan/plan-overview.md "Its address": while the Overview is open the address is #overview, written
// over the entry as the tab pin is; a card over it takes its own entry; Back and Forward walk them.

const TABS = [{ id: 't1' }, { id: 't2' }];

function setup(initial: { overviewOpen: boolean; enabled?: boolean }) {
  const arrivingRef = { current: null as string | null };
  const hook = renderHook(() => {
    const [activeId, setActiveId] = useState('t1');
    const [overviewOpen, setOverviewOpen] = useState(initial.overviewOpen);
    const [shownId, setShownId] = useState<string | null>(null);
    const selectTab = (id: string) => {
      setOverviewOpen(false);
      setActiveId(id);
    };
    useTabEntryEffects({
      hydrated: true,
      activeId,
      elementCount: 0,
      tabLoaded: true,
      fitToScreen: () => {},
      overviewOpen,
    });
    useCardAddress({
      hydrated: true,
      activeId,
      shownId,
      openItemId: shownId,
      arrivingRef,
      openItem: setShownId,
      closeItem: () => setShownId(null),
      overviewOpen,
    });
    useOverviewHistory({
      hydrated: true,
      activeId,
      overviewOpen,
      tabs: TABS,
      showOverview: () => setOverviewOpen(true),
      selectTab,
      enabled: initial.enabled ?? true,
    });
    return { activeId, overviewOpen, shownId, selectTab, setOverviewOpen, setShownId };
  });
  return hook;
}

const popTo = (hash: string) =>
  act(() => {
    window.history.replaceState(null, '', `/project/p1${hash}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  });

beforeEach(() => window.history.replaceState(null, '', '/project/p1'));
afterEach(() => {
  vi.restoreAllMocks();
  window.history.replaceState(null, '', '/');
});

describe('the Overview’s address', () => {
  it('reads #overview while the Overview is open, the tab pin once a tab is pressed', () => {
    const push = vi.spyOn(window.history, 'pushState');
    const { result } = setup({ overviewOpen: true });
    expect(window.location.hash).toBe('#overview');
    act(() => result.current.selectTab('t2'));
    expect(window.location.hash).toBe('#t=t2');
    act(() => result.current.setOverviewOpen(true));
    expect(window.location.hash).toBe('#overview');
    // Switching adds no history entries.
    expect(push).not.toHaveBeenCalled();
  });

  it('gives a card opened over the Overview its own entry, and #overview again once it closes', () => {
    const push = vi.spyOn(window.history, 'pushState');
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
    const { result } = setup({ overviewOpen: true });
    act(() => result.current.setShownId('c1'));
    expect(push).toHaveBeenCalledOnce();
    expect(window.location.hash).toBe('#t=t1&item=c1');
    expect(result.current.overviewOpen).toBe(true);
    act(() => result.current.setShownId(null));
    expect(back).toHaveBeenCalledOnce();
  });

  it('opens the Overview on Back or Forward onto #overview', () => {
    const { result } = setup({ overviewOpen: false });
    expect(window.location.hash).toBe('#t=t1');
    popTo('#overview');
    expect(result.current.overviewOpen).toBe(true);
  });

  it('opens the tab on Back or Forward onto its pin while the Overview is open', () => {
    const { result } = setup({ overviewOpen: true });
    popTo('#t=t2');
    expect(result.current.overviewOpen).toBe(false);
    expect(result.current.activeId).toBe('t2');
    expect(window.location.hash).toBe('#t=t2');
  });

  it('leaves a card’s entry and an unknown tab alone', () => {
    const { result } = setup({ overviewOpen: true });
    popTo('#t=t2&item=c1');
    expect(result.current.overviewOpen).toBe(true);
    popTo('#t=gone');
    expect(result.current.overviewOpen).toBe(true);
    expect(result.current.activeId).toBe('t1');
  });

  it('does nothing where there is no Overview (an embed, a tab-scoped session)', () => {
    const { result } = setup({ overviewOpen: false, enabled: false });
    popTo('#overview');
    expect(result.current.overviewOpen).toBe(false);
  });
});
