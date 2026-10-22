// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { isSaveFailing, noteSaveFailing, useSaveFailing } from './save-health';

// docs/specs/007-editor/load-recovery.md "A failing save stays on screen".
afterEach(() => noteSaveFailing(false));

describe('save health', () => {
  it('holds whether the last save failed, and re-renders its readers on a change', () => {
    const { result } = renderHook(() => useSaveFailing());
    expect(result.current).toBe(false);
    act(() => noteSaveFailing(true));
    expect(result.current).toBe(true);
    expect(isSaveFailing()).toBe(true);
    act(() => noteSaveFailing(false));
    expect(result.current).toBe(false);
  });
});
