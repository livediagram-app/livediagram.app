// @vitest-environment jsdom

// docs/specs/012-collaboration/bring-focus.md "Where it takes you": on your own tab only the pan moves; on
// another tab the tab enters fitted, as any tab does, and the point is centred at that fitted zoom.

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useFocusLanding } from './useFocusLanding';

const AT = { x: 400, y: 300 };

function setup(activeId = 'tab-a') {
  const setActiveId = vi.fn();
  const centreOn = vi.fn();
  const hook = renderHook(() => useFocusLanding({ activeId, setActiveId, centreOn }));
  return { hook, setActiveId, centreOn };
}

describe('useFocusLanding', () => {
  it('centres straight away on your own tab, keeping your zoom', () => {
    const { hook, setActiveId, centreOn } = setup();
    act(() => {
      hook.result.current.onFollowTab('tab-a');
      hook.result.current.onCentreOn(AT);
    });
    expect(setActiveId).not.toHaveBeenCalled();
    expect(centreOn).toHaveBeenCalledWith(AT);
  });

  it("on another tab, waits for that tab's fit and centres after it", () => {
    const { hook, setActiveId, centreOn } = setup();
    act(() => {
      hook.result.current.onFollowTab('tab-b');
      hook.result.current.onCentreOn(AT);
    });
    expect(setActiveId).toHaveBeenCalledWith('tab-b');
    // Not yet: centring now would aim the canvas being left, at the zoom fitted to it.
    expect(centreOn).not.toHaveBeenCalled();
    act(() => hook.result.current.afterTabFit('tab-b'));
    expect(centreOn).toHaveBeenCalledWith(AT);
    // Once: a later fit of the same tab is an ordinary one.
    act(() => hook.result.current.afterTabFit('tab-b'));
    expect(centreOn).toHaveBeenCalledTimes(1);
  });

  it('drops a landing when another tab fits first', () => {
    const { hook, centreOn } = setup();
    act(() => {
      hook.result.current.onFollowTab('tab-b');
      hook.result.current.onCentreOn(AT);
    });
    act(() => hook.result.current.afterTabFit('tab-c'));
    act(() => hook.result.current.afterTabFit('tab-b'));
    expect(centreOn).not.toHaveBeenCalled();
  });

  it('leaves an ordinary tab fit alone', () => {
    const { hook, centreOn } = setup();
    act(() => hook.result.current.afterTabFit('tab-a'));
    expect(centreOn).not.toHaveBeenCalled();
  });
});
