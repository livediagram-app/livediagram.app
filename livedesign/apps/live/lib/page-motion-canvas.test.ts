// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PAGE_MOTIONS } from '@livedesign/design';
import { blurredDisc, paintMotionFrame, rgba, type MotionFrameCache } from './page-motion-canvas';

// A slide's animated background painted still for the PNG and PDF export (docs/specs/007-editor/
// pages-mode.md "Animated backgrounds"). The canvas is a recorder here; the paint was checked
// side by side with the moving layer in a browser.

type Call = { name: string; args: unknown[] };
let calls: Call[] = [];

function recorder(): CanvasRenderingContext2D {
  const gradient = { addColorStop: () => undefined };
  return new Proxy<Record<string | symbol, unknown>>(
    {},
    {
      get: (target, key) => {
        if (key in target) return target[key];
        if (key === 'getTransform') return () => ({ a: 2, b: 0 });
        if (key === 'getContext') return undefined;
        return (...args: unknown[]) => {
          calls.push({ name: String(key), args });
          return key.toString().startsWith('create') ? gradient : undefined;
        };
      },
      set: (target, key, value) => {
        target[key] = value;
        return true;
      },
    },
  ) as unknown as CanvasRenderingContext2D;
}

beforeEach(() => {
  calls = [];
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => recorder());
  vi.stubGlobal(
    'Path2D',
    class {
      d: string;
      constructor(d: string) {
        this.d = d;
      }
    },
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const fill = { from: '#1e3a8a', to: '#4c1d95' };
const rect = { x: 10, y: 20, width: 1920, height: 1080 };

describe('paintMotionFrame', () => {
  it.each(PAGE_MOTIONS)('paints %s inside the page and puts the canvas back', (motion) => {
    const ctx = recorder();
    paintMotionFrame(ctx, motion, fill, rect);
    const names = calls.map((c) => c.name);
    expect(names).toContain('clip');
    expect(names.filter((n) => n === 'save').length).toBe(
      names.filter((n) => n === 'restore').length,
    );
    // Something was drawn: a fill, a stroke or a masked layer laid down.
    expect(names.some((n) => ['fill', 'fillRect', 'stroke', 'drawImage'].includes(n))).toBe(true);
    // Clipped to the page it was given.
    expect(calls.find((c) => c.name === 'rect')?.args).toEqual([10, 20, 1920, 1080]);
  });

  it('paints a background once for a deck that repeats it', () => {
    const cache: MotionFrameCache = new Map();
    paintMotionFrame(recorder(), 'aurora', fill, rect, cache);
    const first = calls.filter((c) => c.name.startsWith('create')).length;
    paintMotionFrame(recorder(), 'aurora', fill, { ...rect, x: 3000 }, cache);
    expect(calls.filter((c) => c.name.startsWith('create')).length).toBe(first);
    expect(calls.filter((c) => c.name === 'drawImage').map((c) => c.args.slice(1))).toEqual([
      [10, 20, 1920, 1080],
      [3000, 20, 1920, 1080],
    ]);
    expect(cache.size).toBe(1);
  });

  it('keeps at most two painted frames', () => {
    const cache: MotionFrameCache = new Map();
    for (const motion of ['aurora', 'mesh', 'lava'] as const) {
      paintMotionFrame(recorder(), motion, fill, rect, cache);
    }
    expect([...cache.keys()].map((k) => k.split('|')[0])).toEqual(['mesh', 'lava']);
  });
});

describe('blurredDisc', () => {
  it('is solid well inside a wide disc and half at its edge', () => {
    expect(blurredDisc(100, 2, 0)).toBeCloseTo(1);
    expect(blurredDisc(100, 2, 100)).toBeCloseTo(0.5, 2);
    expect(blurredDisc(100, 2, 120)).toBeCloseTo(0);
  });

  it('is faint for a small disc under a wide blur, as a star glows on screen', () => {
    expect(blurredDisc(1, 2, 0)).toBeLessThan(0.4);
  });
});

describe('rgba', () => {
  it('turns a hex and an alpha into the canvas colour', () => {
    expect(rgba('#ff8000', 0.5)).toBe('rgba(255, 128, 0, 0.5)');
  });

  it('reads a named colour, and leaves one it cannot read as it is', () => {
    expect(rgba('red', 0.5)).toBe('rgba(255, 0, 0, 0.5)');
    expect(rgba('transparent', 0.5)).toBe('transparent');
  });
});
