// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock('@/lib/telemetry', () => ({ track: m.track }));

import { flowViewOn, toggleFlowView, useFlowView } from './flow-view-store';

// docs/specs/007-editor/wireframe-pages.md "Flow view": off on load, flipped by its switch, telling telemetry first.
describe('the Flow view store', () => {
  it('starts off, flips on and off, and tracks each flip', () => {
    const { result } = renderHook(() => useFlowView());
    expect(result.current).toBe(false);
    act(() => toggleFlowView());
    expect(result.current).toBe(true);
    expect(flowViewOn()).toBe(true);
    expect(m.track).toHaveBeenLastCalledWith('UI', 'Toggled', 'FlowViewOn');
    act(() => toggleFlowView());
    expect(result.current).toBe(false);
    expect(m.track).toHaveBeenLastCalledWith('UI', 'Toggled', 'FlowViewOff');
  });
});
