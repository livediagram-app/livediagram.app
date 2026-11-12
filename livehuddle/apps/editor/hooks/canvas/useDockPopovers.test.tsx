// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const trackMock = vi.fn<typeof import('@/lib/telemetry').track>();
vi.mock('@/lib/telemetry', () => ({
  track: (...a: Parameters<typeof trackMock>) => trackMock(...a),
}));

const { useDockPopovers } = await import('./useDockPopovers');

const button = () => document.createElement('button');

// The Explorer is the one dock popover (the Collaborate Panel left livehuddle, docs/specs/002-project-scope/
// not-in-livehuddle.md "Comments, actions, links and notes"), and its open counts nothing here.
describe('useDockPopovers', () => {
  beforeEach(() => trackMock.mockReset());

  it('opens and closes the Explorer and counts nothing', () => {
    const { result } = renderHook(() => useDockPopovers({ current: null }));
    act(() => result.current.handleDockButtonClick('explorer', button()));
    expect(trackMock).not.toHaveBeenCalled();
    expect(result.current.activeDockPanel).toBe('explorer');
    act(() => result.current.handleDockButtonClick('explorer', button()));
    expect(result.current.activeDockPanel).toBeNull();
  });
});
