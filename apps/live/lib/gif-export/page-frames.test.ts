import { describe, expect, it } from 'vitest';
import { composeFrame, type FrameContext } from './page-frames';

// docs/specs/020-import-export/blueprints/animated-gif-export.md "Frames".
function fakeContext() {
  const calls: string[] = [];
  const ctx = {
    fillStyle: '',
    globalAlpha: 1,
    fillRect: (x: number, y: number, w: number, h: number) =>
      calls.push(`fill ${String(ctx.fillStyle)} ${x},${y} ${w}x${h}`),
    drawImage: (img: unknown, x: number, y: number) =>
      calls.push(`draw ${String(img)} ${x},${y} a=${ctx.globalAlpha}`),
  };
  return { ctx: ctx as unknown as FrameContext, calls };
}
const IN = 'in' as unknown as CanvasImageSource;
const OUT = 'out' as unknown as CanvasImageSource;
const under = { page: 1, t: 67, from: { page: 0, t: 3067 }, mix: 0.25, delayCs: 7 };

describe('composing a frame', () => {
  it('lays white paper under a page, for a logo page’s see-through paper', () => {
    const { ctx, calls } = fakeContext();
    composeFrame(ctx, { page: 0, t: 0, mix: 1, delayCs: 7 }, 'fade', 100, 50, { incoming: IN });
    expect(calls).toEqual(['fill #ffffff 0,0 100x50', 'draw in 0,0 a=1']);
  });

  it('fades the incoming page in over the outgoing one', () => {
    const { ctx, calls } = fakeContext();
    composeFrame(ctx, under, 'fade', 100, 50, { incoming: IN, outgoing: OUT });
    expect(calls.slice(1)).toEqual(['draw out 0,0 a=1', 'draw in 0,0 a=0.25']);
    expect(ctx.globalAlpha).toBe(1);
  });

  it('slides the outgoing page out left as the incoming one comes in from the right', () => {
    const { ctx, calls } = fakeContext();
    composeFrame(ctx, under, 'slide', 100, 50, { incoming: IN, outgoing: OUT });
    expect(calls.slice(1)).toEqual(['draw out -25,0 a=1', 'draw in 75,0 a=1']);
  });

  it('cuts with no transition', () => {
    const { ctx, calls } = fakeContext();
    composeFrame(ctx, under, 'none', 100, 50, { incoming: IN, outgoing: OUT });
    expect(calls.slice(1)).toEqual(['draw in 0,0 a=1']);
  });
});
