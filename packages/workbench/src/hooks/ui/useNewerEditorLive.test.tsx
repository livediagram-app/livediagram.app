// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LiveEditor } from '../../lib/live-editor-build';
import {
  LIVE_BUILD_MAX_CHECKS,
  LIVE_BUILD_POLL_MS,
  useNewerEditorLive,
} from './useNewerEditorLive';

// docs/specs/016-platform/new-version-prompt.md "When the prompt shows", in each product.
let visibility: DocumentVisibilityState = 'visible';
const setVisibility = (state: DocumentVisibilityState) => {
  visibility = state;
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
};

beforeEach(() => {
  vi.useFakeTimers();
  visibility = 'visible';
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const answering = (...answers: LiveEditor[]) => {
  const check = vi.fn<() => Promise<LiveEditor>>();
  for (const answer of answers) check.mockResolvedValueOnce(answer);
  check.mockResolvedValue(answers.at(-1)!);
  return check;
};
const flush = () => act(async () => vi.advanceTimersByTimeAsync(0));
const minute = () => act(async () => vi.advanceTimersByTimeAsync(LIVE_BUILD_POLL_MS));

describe('useNewerEditorLive', () => {
  it('asks nothing while inactive', async () => {
    const check = answering('newer');
    const { result } = renderHook(() => useNewerEditorLive(false, check));
    await minute();
    expect(check).not.toHaveBeenCalled();
    expect(result.current).toBe(false);
  });

  it('is ready at once on a newer or unknown build', async () => {
    for (const answer of ['newer', 'unknown'] as const) {
      const check = answering(answer);
      const { result, unmount } = renderHook(() => useNewerEditorLive(true, check));
      await flush();
      expect(result.current).toBe(true);
      expect(check).toHaveBeenCalledTimes(1);
      unmount();
    }
  });

  it('waits while the page serves the same build, asking once a minute, then settles', async () => {
    const check = answering('same', 'same', 'newer');
    const { result } = renderHook(() => useNewerEditorLive(true, check));
    await flush();
    expect(result.current).toBe(false);
    await minute();
    expect(check).toHaveBeenCalledTimes(2);
    expect(result.current).toBe(false);
    await minute();
    expect(check).toHaveBeenCalledTimes(3);
    expect(result.current).toBe(true);
    await minute();
    expect(check).toHaveBeenCalledTimes(3);
  });

  it(`stops waiting after ${LIVE_BUILD_MAX_CHECKS} checks, so the prompt never vanishes for good`, async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const check = answering('same');
    const { result } = renderHook(() => useNewerEditorLive(true, check));
    await flush();
    for (let i = 1; i < LIVE_BUILD_MAX_CHECKS; i++) await minute();
    expect(check).toHaveBeenCalledTimes(LIVE_BUILD_MAX_CHECKS);
    expect(result.current).toBe(true);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('the page still serves this editor'),
      { checks: LIVE_BUILD_MAX_CHECKS },
    );
  });

  it('pauses while the page is hidden and resumes when it is back', async () => {
    const check = answering('same');
    renderHook(() => useNewerEditorLive(true, check));
    await flush();
    setVisibility('hidden');
    await minute();
    await minute();
    expect(check).toHaveBeenCalledTimes(1);
    // Back after more than a minute: it asks at once.
    setVisibility('visible');
    await flush();
    expect(check).toHaveBeenCalledTimes(2);
    // Back again within the minute: it waits out the rest of it.
    await act(async () => vi.advanceTimersByTimeAsync(LIVE_BUILD_POLL_MS / 2));
    setVisibility('hidden');
    setVisibility('visible');
    await act(async () => vi.advanceTimersByTimeAsync(LIVE_BUILD_POLL_MS / 2 - 1));
    expect(check).toHaveBeenCalledTimes(2);
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(check).toHaveBeenCalledTimes(3);
    // Shown again while a minute is already running: no second timer.
    setVisibility('visible');
    await minute();
    expect(check).toHaveBeenCalledTimes(4);
  });

  it('hidden while a check is out: the answer schedules nothing until the page is back', async () => {
    let answer: (live: LiveEditor) => void = () => {};
    const check = vi.fn(() => new Promise<LiveEditor>((resolve) => (answer = resolve)));
    renderHook(() => useNewerEditorLive(true, check));
    setVisibility('hidden');
    setVisibility('visible');
    setVisibility('hidden');
    await act(async () => answer('same'));
    await minute();
    expect(check).toHaveBeenCalledTimes(1);
    setVisibility('visible');
    await flush();
    expect(check).toHaveBeenCalledTimes(2);
  });

  it('drops an answer that arrives after unmount', async () => {
    let answer: (live: LiveEditor) => void = () => {};
    const check = vi.fn(() => new Promise<LiveEditor>((resolve) => (answer = resolve)));
    const { result, unmount } = renderHook(() => useNewerEditorLive(true, check));
    unmount();
    await act(async () => answer('newer'));
    expect(result.current).toBe(false);
  });
});
