// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useBusyIds } from './useBusyIds';

describe('useBusyIds', () => {
  it('marks an id while its work runs and clears it when the work settles', async () => {
    const { result } = renderHook(() => useBusyIds());
    let finish!: () => void;
    let done!: Promise<void>;
    act(() => {
      done = result.current[1](
        'a',
        () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          }),
      );
    });
    expect([...result.current[0]]).toEqual(['a']);
    await act(async () => {
      finish();
      await done;
    });
    expect(result.current[0].size).toBe(0);
  });

  it('clears the id when the work throws, and passes the failure on', async () => {
    const { result } = renderHook(() => useBusyIds());
    let caught: unknown;
    await act(async () => {
      await result.current[1]('a', () => Promise.reject(new Error('no'))).catch((error) => {
        caught = error;
      });
    });
    expect(caught).toBeInstanceOf(Error);
    expect(result.current[0].size).toBe(0);
  });
});
