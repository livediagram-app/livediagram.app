import { describe, expect, it } from 'vitest';
import {
  GIF_FPS,
  gifFrameSize,
  gifHoldDefault,
  gifSizeLabel,
  gifTimeline,
  gifTooLong,
  type GifTimelineInput,
} from './gif-timeline';

// docs/specs/020-import-export/animated-gif-export.md "The timeline".
const base: GifTimelineInput = {
  pageCount: 2,
  holdSeconds: 3,
  transition: 'none',
  transitionMs: 380,
  stillPages: new Set(),
  loops: true,
};
const totalCs = (frames: { delayCs: number }[]) => frames.reduce((s, f) => s + f.delayCs, 0);

describe('the GIF timeline', () => {
  it('runs at 15 frames a second, each page exactly its hold', () => {
    const frames = gifTimeline(base);
    expect(frames).toHaveLength(2 * 3 * GIF_FPS);
    expect(totalCs(frames)).toBe(600);
    expect(totalCs(frames.filter((f) => f.page === 0))).toBe(300);
    // 7, 6, 7 centiseconds: 15 fps exactly over every three frames.
    expect(frames.slice(0, 3).map((f) => f.delayCs)).toEqual([7, 6, 7]);
    expect(frames[1]!.t).toBe(67);
  });

  it('starts each page’s clock at zero as it comes in', () => {
    const frames = gifTimeline(base);
    expect(frames[45]).toMatchObject({ page: 1, t: 0 });
  });

  it('keeps a half-second hold exact', () => {
    const frames = gifTimeline({ ...base, holdSeconds: 1.5, pageCount: 1, loops: false });
    expect(totalCs(frames)).toBe(150);
  });

  it('cuts between pages with no transition', () => {
    expect(gifTimeline(base).some((f) => f.from)).toBe(false);
  });

  it('runs the deck’s transition over the first part of each page, the outgoing clock running on', () => {
    const frames = gifTimeline({ ...base, transition: 'fade' });
    const into1 = frames.filter((f) => f.page === 1 && f.from);
    // 0, 67, ..., 333 ms are under 380 ms: six frames.
    expect(into1).toHaveLength(6);
    expect(into1[0]).toMatchObject({ t: 0, from: { page: 0, t: 3000 }, mix: 0 });
    expect(into1[5]!.from).toEqual({ page: 0, t: 3333 });
    const mixes = into1.map((f) => f.mix);
    expect([...mixes].sort((a, b) => a - b)).toEqual(mixes);
    expect(mixes[5]!).toBeLessThan(1);
    expect(frames.find((f) => f.page === 1 && !f.from)?.mix).toBe(1);
  });

  it('comes back round from the last page to the first, with no seam', () => {
    const frames = gifTimeline({ ...base, transition: 'slide' });
    expect(frames[0]!.from).toEqual({ page: 1, t: 3000 });
  });

  it('eases a slide as presenting does', () => {
    const fade = gifTimeline({ ...base, transition: 'fade' })[2]!.mix;
    const slide = gifTimeline({ ...base, transition: 'slide' })[2]!.mix;
    expect(slide).not.toBeCloseTo(fade, 3);
  });

  it('shortens a transition to half a short hold', () => {
    const frames = gifTimeline({ ...base, holdSeconds: 1, transition: 'fade', transitionMs: 620 });
    expect(Math.max(...frames.filter((f) => f.from).map((f) => f.t))).toBeLessThan(500);
  });

  it('shows a still page as one frame for its hold', () => {
    const frames = gifTimeline({ ...base, stillPages: new Set([0]) });
    const first = frames.filter((f) => f.page === 0);
    expect(first).toEqual([{ page: 0, t: 0, mix: 1, delayCs: 300 }]);
    expect(totalCs(frames)).toBe(600);
  });

  it('keeps a still page’s transition frames, then holds one settled frame', () => {
    const frames = gifTimeline({ ...base, transition: 'fade', stillPages: new Set([1]) });
    const second = frames.filter((f) => f.page === 1);
    expect(second.filter((f) => f.from)).toHaveLength(6);
    expect(second).toHaveLength(7);
    expect(second[6]).toMatchObject({ t: 400, mix: 1 });
    expect(totalCs(second)).toBe(300);
  });

  it('loops one page with no transition', () => {
    const frames = gifTimeline({ ...base, pageCount: 1, loops: false, transition: 'slide' });
    expect(frames.some((f) => f.from)).toBe(false);
    expect(totalCs(frames)).toBe(300);
  });

  it('refuses past three minutes', () => {
    expect(gifTooLong(9, 20)).toBe(false);
    expect(gifTooLong(10, 18.5)).toBe(true);
  });
});

describe('the GIF options', () => {
  it('starts the hold at the deck’s Auto-advance, within range, or three seconds', () => {
    expect(gifHoldDefault(0)).toBe(3);
    expect(gifHoldDefault(5)).toBe(5);
    expect(gifHoldDefault(60)).toBe(20);
  });

  it('sizes a frame by its longer side', () => {
    expect(gifFrameSize({ width: 1920, height: 1080 }, 'medium')).toEqual({
      width: 960,
      height: 540,
    });
    expect(gifFrameSize({ width: 794, height: 1123 }, 'small')).toEqual({
      width: 339,
      height: 480,
    });
    expect(gifFrameSize({ width: 1440, height: 1440 }, 'large')).toEqual({
      width: 1440,
      height: 1440,
    });
  });

  it('words the estimate', () => {
    expect(gifSizeLabel(640_400)).toBe('About 640 KB');
    expect(gifSizeLabel(3_420_000)).toBe('About 3.4 MB');
  });
});
