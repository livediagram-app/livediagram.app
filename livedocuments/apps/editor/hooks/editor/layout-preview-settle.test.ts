// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPreviewSettle, LAYOUT_PREVIEW_SETTLE_MS } from './layout-preview-settle';

// docs/specs/007-editor/pages-mode.md "Hover previews the layout on the page, exactly as it lands" (Work Tracker
// 1502): a sweep across the tiles draws only the tile the pointer settles on; a focused tile is drawn at once.

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'],
  });
});
afterEach(() => {
  vi.useRealTimers();
});

const SWEEP_STEP_MS = 50;

describe('createPreviewSettle', () => {
  it('runs only the last of a pointer sweep across tiles, once it settles', () => {
    const settle = createPreviewSettle();
    const ran: number[] = [];
    for (let tile = 0; tile < 8; tile++) {
      settle.ask('pointer', () => ran.push(tile));
      vi.advanceTimersByTime(SWEEP_STEP_MS);
    }
    expect(ran).toEqual([]);
    vi.advanceTimersByTime(LAYOUT_PREVIEW_SETTLE_MS + 20);
    expect(ran).toEqual([7]);
  });

  it('runs a focused tile on the next frame, without the settle wait, and only the newest of a frame', () => {
    const settle = createPreviewSettle();
    const ran: string[] = [];
    settle.ask('focus', () => ran.push('a'));
    settle.ask('focus', () => ran.push('b'));
    vi.advanceTimersByTime(20);
    expect(ran).toEqual(['b']);
  });

  it('drops a waiting ask on cancel', () => {
    const settle = createPreviewSettle();
    const run = vi.fn();
    settle.ask('pointer', run);
    settle.cancel();
    settle.ask('focus', run);
    settle.cancel();
    vi.advanceTimersByTime(LAYOUT_PREVIEW_SETTLE_MS * 2);
    expect(run).not.toHaveBeenCalled();
  });
});
