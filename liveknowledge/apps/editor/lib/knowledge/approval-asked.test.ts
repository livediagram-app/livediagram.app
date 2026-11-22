// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { askApproval, clearApprovalAsk, useApprovalAsked } from './approval-asked';

describe('approval asked from the page menu', () => {
  it('holds one page until it is cleared', () => {
    const { result } = renderHook(() => useApprovalAsked('p1'));
    expect(result.current).toBe(false);
    act(() => askApproval('p1'));
    expect(result.current).toBe(true);
    act(() => askApproval('p2'));
    expect(result.current).toBe(false);
    act(() => askApproval('p1'));
    act(() => clearApprovalAsk());
    expect(result.current).toBe(false);
    clearApprovalAsk();
  });
});
