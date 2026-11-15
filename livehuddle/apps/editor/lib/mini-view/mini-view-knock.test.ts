// The knock on show in the mini view (docs/specs/008-canvas/avatar-mode.md "The mini view"; blueprint:
// space-mini-view.md "Knocks").
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TOAST_ANSWER_TIMEOUT_MS } from '@liveworkspace/workbench/components/toast/toast-queue';
import { clearMiniKnock, miniKnock, resetMiniKnock, showMiniKnock } from './mini-view-knock';

afterEach(() => {
  resetMiniKnock();
  vi.useRealTimers();
});

const knock = (from: string) => ({ from, name: from.toUpperCase(), answer: vi.fn() });

describe('mini view knock', () => {
  it('shows one knock, a later one replacing it', () => {
    showMiniKnock(knock('a'));
    const b = knock('b');
    showMiniKnock(b);
    expect(miniKnock()).toBe(b);
  });

  it('clears only the knock of the person answered', () => {
    showMiniKnock(knock('a'));
    clearMiniKnock('b');
    expect(miniKnock()?.from).toBe('a');
    clearMiniKnock('a');
    expect(miniKnock()).toBeNull();
  });

  it('goes after the toast’s own answer timeout', () => {
    vi.useFakeTimers();
    showMiniKnock(knock('a'));
    vi.advanceTimersByTime(TOAST_ANSWER_TIMEOUT_MS - 1);
    expect(miniKnock()).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(miniKnock()).toBeNull();
  });

  it('restarts the timeout when a second knock replaces the first', () => {
    vi.useFakeTimers();
    showMiniKnock(knock('a'));
    vi.advanceTimersByTime(TOAST_ANSWER_TIMEOUT_MS - 10);
    showMiniKnock(knock('a'));
    vi.advanceTimersByTime(20);
    expect(miniKnock()?.from).toBe('a');
  });
});
