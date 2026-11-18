// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useRegisterShownCards, useShownCards } from './board-shown-store';

// docs/specs/012-collaboration/walkthroughs.md "No dead control": the board filling its tab says whether it shows a card.
describe('the board-shown store', () => {
  it("holds the registered board's answer while it is on screen, and none after", () => {
    const reader = renderHook(() => useShownCards());
    const board = renderHook(({ any }) => useRegisterShownCards('b', any, true), {
      initialProps: { any: false },
    });
    expect(reader.result.current).toEqual({ elementId: 'b', any: false });
    board.rerender({ any: true });
    expect(reader.result.current).toEqual({ elementId: 'b', any: true });
    board.unmount();
    expect(reader.result.current).toBeNull();
  });

  it("leaves a newer board's answer when an older one goes", () => {
    const reader = renderHook(() => useShownCards());
    const older = renderHook(() => useRegisterShownCards('old', true, true));
    const newer = renderHook(() => useRegisterShownCards('new', false, true));
    older.unmount();
    expect(reader.result.current).toEqual({ elementId: 'new', any: false });
    newer.unmount();
    expect(reader.result.current).toBeNull();
  });

  it('registers nothing while off', () => {
    const reader = renderHook(() => useShownCards());
    renderHook(() => useRegisterShownCards('b', true, false));
    expect(reader.result.current).toBeNull();
  });
});
