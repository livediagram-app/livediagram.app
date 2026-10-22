// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useSlotDraft } from './useSlotDraft';

// docs/specs/026-plan/plan-tabs.md "Dashboard tab": a note's or title's text follows a change from elsewhere unless
// it holds unsaved typing.
describe('a slot’s draft text', () => {
  it('follows the stored value while nothing is typed', () => {
    const { result, rerender } = renderHook(({ v }) => useSlotDraft(v), {
      initialProps: { v: 'One' },
    });
    rerender({ v: 'Two' });
    expect(result.current[0]).toBe('Two');
  });

  it('keeps unsaved typing when the stored value moves on', () => {
    const { result, rerender } = renderHook(({ v }) => useSlotDraft(v), {
      initialProps: { v: 'One' },
    });
    act(() => result.current[1]('Typing'));
    rerender({ v: 'Two' });
    expect(result.current[0]).toBe('Typing');
  });
});
