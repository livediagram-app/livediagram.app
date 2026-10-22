// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useReleaseSelectionLock } from './useReleaseSelectionLock';

// docs/specs/007-editor/live-app.md: any Editor frees an element somebody else is holding.
describe('useReleaseSelectionLock', () => {
  it('asks the room to free the holder’s element', () => {
    const send = vi.fn();
    const { result } = renderHook(() => useReleaseSelectionLock({ send }));
    result.current('p2', 'el-1');
    expect(send).toHaveBeenCalledWith({
      kind: 'facilitator',
      action: 'unlock',
      target: 'p2',
      elementId: 'el-1',
    });
  });
});
