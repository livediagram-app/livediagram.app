// @vitest-environment jsdom
// The create reads the document count from before it (docs/specs/007-editor/editor-tour.md "Where it appears").
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DOCUMENT_COUNT_WAIT_MS, useDocumentCount } from './useDocumentCount';

describe('useDocumentCount', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('waits for a count that has not arrived yet: a quick pick still offers the tour', async () => {
    const { result } = renderHook(() => useDocumentCount());
    const pending = result.current.settled();
    act(() => result.current.report(0));
    await expect(pending).resolves.toBe(0);
  });

  it('answers at once once the count is in', async () => {
    const { result } = renderHook(() => useDocumentCount());
    act(() => result.current.report(3));
    await expect(result.current.settled()).resolves.toBe(3);
  });

  it('keeps the first count: a re-read after the create (which counts the new document) never replaces it', async () => {
    const { result } = renderHook(() => useDocumentCount());
    act(() => result.current.report(0));
    act(() => result.current.report(1));
    await expect(result.current.settled()).resolves.toBe(0);
  });

  it('gives up after the wait, answering unknown', async () => {
    const { result } = renderHook(() => useDocumentCount());
    const pending = result.current.settled();
    await act(() => vi.advanceTimersByTimeAsync(DOCUMENT_COUNT_WAIT_MS));
    await expect(pending).resolves.toBeNull();
    // A late report wakes nobody and is still kept for the next read.
    act(() => result.current.report(0));
    await expect(result.current.settled()).resolves.toBe(0);
  });

  it('never waits when told not to (This Browser opens at once)', async () => {
    const { result } = renderHook(() => useDocumentCount());
    await expect(result.current.settled(0)).resolves.toBeNull();
  });
});
