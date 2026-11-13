// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createPagePanelRequest } from './page-panel-request';

describe('createPagePanelRequest', () => {
  it('opens each new request once, on its tab or the default, and closes on a null page', () => {
    const { requestPagePanel, useFollowPagePanelRequests } = createPagePanelRequest<
      'page' | 'device'
    >('page');
    const setOpened = vi.fn();
    const { rerender } = renderHook(() => useFollowPagePanelRequests(setOpened));
    expect(setOpened).not.toHaveBeenCalled();
    act(() => requestPagePanel('p1', 'device'));
    expect(setOpened).toHaveBeenLastCalledWith({ id: 'p1', tab: 'device', seq: 1 });
    rerender();
    expect(setOpened).toHaveBeenCalledTimes(1);
    act(() => requestPagePanel('p2'));
    expect(setOpened).toHaveBeenLastCalledWith({ id: 'p2', tab: 'page', seq: 2 });
    act(() => requestPagePanel(null));
    expect(setOpened).toHaveBeenLastCalledWith(null);
  });
});
