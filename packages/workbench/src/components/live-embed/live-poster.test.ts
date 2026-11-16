// @vitest-environment jsdom

// A live embed's snapshot picture (live-embeds.md "The snapshot picture"): the item's preview with the reader's own
// token, drawn at most LIVE_POSTER_MAX_EDGE on its longer side, kept as the first raster encoding under the cap.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LIVE_POSTER_MAX_CHARS } from '@liveworkspace/element-model/live-item';
import { configureWorkbench, WORKBENCH_DEFAULTS } from '../../bindings';
import { testBindings } from '../../lib/testing/bindings';
import { captureLivePoster, encodePoster, posterSize } from './live-poster';

const ORIGIN = 'https://www.livediagram.app';
let fetched: { url: string; auth: string | null }[];
let image: { width: number; height: number; fails?: boolean };
let encoded: string[];
let drawn: number[][];

class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 0;
  naturalHeight = 0;
  set src(_: string) {
    queueMicrotask(() => {
      if (image.fails) return this.onerror?.();
      this.naturalWidth = image.width;
      this.naturalHeight = image.height;
      this.onload?.();
    });
  }
}

beforeEach(() => {
  fetched = [];
  image = { width: 1600, height: 900 };
  encoded = ['data:image/webp;base64,AAAA'];
  drawn = [];
  configureWorkbench(
    testBindings({
      api: { ...WORKBENCH_DEFAULTS.api, currentBearer: () => Promise.resolve('at-ada') },
    }),
  );
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: URL, init: RequestInit) => {
      fetched.push({ url: String(url), auth: new Headers(init.headers).get('Authorization') });
      return new Response('<svg/>', { status: 200 });
    }),
  );
  vi.stubGlobal('Image', FakeImage);
  URL.createObjectURL = () => 'blob:1';
  URL.revokeObjectURL = () => {};
  HTMLCanvasElement.prototype.getContext = function () {
    return {
      drawImage: (_img: unknown, ...rest: number[]) => void drawn.push(rest),
    } as unknown as CanvasRenderingContext2D;
  } as unknown as typeof HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.toDataURL = () => encoded.shift() ?? 'data:image/png;base64,';
});

afterEach(() => {
  configureWorkbench(WORKBENCH_DEFAULTS);
  vi.unstubAllGlobals();
});

describe('the poster size', () => {
  it('fits the longer side to the cap and never enlarges', () => {
    expect(posterSize(1600, 900)).toEqual({ width: 480, height: 270 });
    expect(posterSize(300, 1200)).toEqual({ width: 120, height: 480 });
    expect(posterSize(200, 100)).toEqual({ width: 200, height: 100 });
    expect(posterSize(0, 0)).toEqual({ width: 1, height: 1 });
  });
});

describe('the poster encoding', () => {
  it('keeps the first raster encoding under the cap, else nothing', () => {
    const canvas = document.createElement('canvas');
    encoded = [
      `data:image/webp;base64,${'A'.repeat(LIVE_POSTER_MAX_CHARS)}`,
      'data:image/webp;base64,BB',
    ];
    expect(encodePoster(canvas)).toBe('data:image/webp;base64,BB');
    encoded = [
      'data:image/png;base64,',
      'data:image/png;base64,',
      'data:image/png;base64,',
      'data:image/png;base64,',
    ];
    expect(encodePoster(canvas)).toBeNull();
  });
});

describe('capturing a poster', () => {
  it("draws the item's preview with the reader's token, in their appearance", async () => {
    expect(await captureLivePoster('p 1', 'dark', ORIGIN)).toBe('data:image/webp;base64,AAAA');
    expect(fetched).toEqual([
      { url: `${ORIGIN}/api/previews/items/p%201?appearance=dark`, auth: 'Bearer at-ada' },
    ]);
    expect(drawn).toEqual([[0, 0, 480, 270]]);
  });

  it('is nothing with no one to ask as, no preview, an empty one, or one that will not draw', async () => {
    configureWorkbench(testBindings());
    expect(await captureLivePoster('p1', 'light', ORIGIN)).toBeNull();
    configureWorkbench(
      testBindings({
        api: { ...WORKBENCH_DEFAULTS.api, currentBearer: () => Promise.resolve('at') },
      }),
    );
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 404 })),
    );
    expect(await captureLivePoster('p1', 'light', ORIGIN)).toBeNull();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline');
      }),
    );
    expect(await captureLivePoster('p1', 'light', ORIGIN)).toBeNull();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 200 })),
    );
    expect(await captureLivePoster('p1', 'light', ORIGIN)).toBeNull();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<svg/>', { status: 200 })),
    );
    image = { width: 10, height: 10, fails: true };
    expect(await captureLivePoster('p1', 'light', ORIGIN)).toBeNull();
    image = { width: 0, height: 10 };
    expect(await captureLivePoster('p1', 'light', ORIGIN)).toBeNull();
    image = { width: 10, height: 10 };
    HTMLCanvasElement.prototype.getContext = (() =>
      null) as typeof HTMLCanvasElement.prototype.getContext;
    expect(await captureLivePoster('p1', 'light', ORIGIN)).toBeNull();
  });

  it("defaults to this page's origin", async () => {
    await captureLivePoster('p1', 'light');
    expect(fetched[0]!.url).toBe(
      `${window.location.origin}/api/previews/items/p1?appearance=light`,
    );
  });
});
