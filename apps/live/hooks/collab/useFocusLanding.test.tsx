// @vitest-environment jsdom

// docs/specs/012-collaboration/bring-focus.md "Where it takes you": on your own tab only the pan moves; on
// another tab the tab enters fitted, as any tab does, and the point lands at that fitted zoom. Where it lands
// (a point, or an Illustrate page) is `land`'s call, given the tab.

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useFocusLanding } from './useFocusLanding';

const AT = { x: 400, y: 300 };

function setup(activeId = 'tab-a') {
  const setActiveId = vi.fn();
  const land = vi.fn();
  const hook = renderHook(() => useFocusLanding({ activeId, setActiveId, land }));
  return { hook, setActiveId, land };
}

describe('useFocusLanding', () => {
  it('centres straight away on your own tab, keeping your zoom', () => {
    const { hook, setActiveId, land } = setup();
    act(() => {
      hook.result.current.onFollowTab('tab-a');
      hook.result.current.onCentreOn(AT);
    });
    expect(setActiveId).not.toHaveBeenCalled();
    expect(land).toHaveBeenCalledWith('tab-a', AT);
  });

  it("on another tab, waits for that tab's fit and centres after it", () => {
    const { hook, setActiveId, land } = setup();
    act(() => {
      hook.result.current.onFollowTab('tab-b');
      hook.result.current.onCentreOn(AT);
    });
    expect(setActiveId).toHaveBeenCalledWith('tab-b');
    // Not yet: centring now would aim the canvas being left, at the zoom fitted to it.
    expect(land).not.toHaveBeenCalled();
    act(() => hook.result.current.afterTabFit('tab-b'));
    // Landed on the tab it was for, so an Illustrate tab can frame the page the point is on.
    expect(land).toHaveBeenCalledWith('tab-b', AT);
    // Once: a later fit of the same tab is an ordinary one.
    act(() => hook.result.current.afterTabFit('tab-b'));
    expect(land).toHaveBeenCalledTimes(1);
  });

  it('drops a landing when another tab fits first', () => {
    const { hook, land } = setup();
    act(() => {
      hook.result.current.onFollowTab('tab-b');
      hook.result.current.onCentreOn(AT);
    });
    act(() => hook.result.current.afterTabFit('tab-c'));
    act(() => hook.result.current.afterTabFit('tab-b'));
    expect(land).not.toHaveBeenCalled();
  });

  it('leaves an ordinary tab fit alone', () => {
    const { hook, land } = setup();
    act(() => hook.result.current.afterTabFit('tab-a'));
    expect(land).not.toHaveBeenCalled();
  });
});
