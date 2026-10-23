// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { layOutPages, type Tab } from '@livedocuments/document';

// A slide's animated background in its exports (docs/specs/007-editor/pages-mode.md
// "Animated backgrounds"): the PNG and PDF paint it as the slide opens over the gradient, the SVG
// embeds the same frame under the pattern, and a PDF of a deck paints a repeated one once. The
// painting itself is page-motion-canvas's; here it is stood in for.

const FRAME = 'data:image/jpeg;base64,AAAA';
vi.mock('./page-motion-canvas', () => ({
  paintMotionFrame: vi.fn(),
  motionFrameHref: vi.fn(() => FRAME),
}));

const { paintMotionFrame, motionFrameHref } = await import('./page-motion-canvas');
const { renderTabToCanvas, renderTabToSvg } = await import('./export-tab');
const { exportPagesAsPdf } = await import('./export-tab-pdf');

beforeEach(() => {
  const ctx = new Proxy(
    {},
    {
      get: (_, key) =>
        key === 'getImageData'
          ? () => ({ data: new Uint8ClampedArray(4) })
          : key === 'measureText'
            ? () => ({ width: 0 })
            : () => undefined,
      set: () => true,
    },
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as never);
  class FakeImage {
    onload: (() => void) | null = null;
    set src(_: string) {
      queueMicrotask(() => this.onload?.());
    }
  }
  vi.stubGlobal('Image', FakeImage);
  // The PDF's deflate: jsdom's Blob has no stream, so an empty one stands in.
  Object.defineProperty(Blob.prototype, 'stream', {
    configurable: true,
    value: () => ({ pipeThrough: () => new ReadableStream({ start: (c) => c.close() }) }),
  });
});

afterEach(() => {
  delete (Blob.prototype as { stream?: unknown }).stream;
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const animated = {
  kind: 'gradient' as const,
  from: '#1e3a8a',
  to: '#4c1d95',
  angle: 135,
  motion: 'aurora' as const,
};

const deck = (fill: object = animated, pattern?: 'dots') => {
  const pages = [1, 2, 3].map((n) => ({
    id: `s${n}`,
    orientation: 'landscape' as const,
    kind: 'slide' as const,
    background: { fill, ...(pattern ? { pattern } : {}) },
  }));
  const tab = { id: 't', name: 'Deck', elements: [], pages } as unknown as Tab;
  return { tab, laid: layOutPages(pages as never) };
};

describe('PNG and PDF', () => {
  it('paint a slide’s motion across its sheet', async () => {
    const { tab, laid } = deck();
    const page = laid[1]!;
    await renderTabToCanvas(tab, { page, fontCss: '' });
    expect(paintMotionFrame).toHaveBeenCalledTimes(1);
    const [, motion, fill, rect] = vi.mocked(paintMotionFrame).mock.calls[0]!;
    expect(motion).toBe('aurora');
    expect(fill).toMatchObject({ from: '#1e3a8a', to: '#4c1d95' });
    // The frame starts at the sheet's corner.
    expect(rect).toEqual({ x: 0, y: 0, width: page.rect.width, height: page.rect.height });
  });

  it('leave a still gradient as it is', async () => {
    const { tab, laid } = deck({ kind: 'gradient', from: '#000000', to: '#ffffff', angle: 90 });
    await renderTabToCanvas(tab, { page: laid[0]!, fontCss: '' });
    expect(paintMotionFrame).not.toHaveBeenCalled();
  });

  it('share one set of painted frames across a whole PDF', async () => {
    const { tab, laid } = deck();
    await exportPagesAsPdf(tab, laid, { fontCss: '' });
    const caches = vi.mocked(paintMotionFrame).mock.calls.map((c) => c[4]);
    expect(caches).toHaveLength(3);
    expect(caches[0]).toBeInstanceOf(Map);
    expect(new Set(caches).size).toBe(1);
  });
});

describe('SVG', () => {
  // The frame is an opaque picture of the gradient with the motion in it: over the pattern it would hide it.
  it('embeds the opening frame over the gradient and under its pattern, so the pattern still shows', () => {
    const { tab, laid } = deck(animated, 'dots');
    const svg = renderTabToSvg(tab, { page: laid[0]!, fontCss: '' });
    const gradient = svg.indexOf('linearGradient');
    const frame = svg.indexOf(`href="${FRAME}"`);
    const pattern = svg.indexOf('<pattern');
    expect(gradient).toBeGreaterThan(-1);
    expect(frame).toBeGreaterThan(gradient);
    expect(pattern).toBeGreaterThan(frame);
    expect(motionFrameHref).toHaveBeenCalledWith(
      expect.objectContaining({ motion: 'aurora' }),
      laid[0]!.rect.width,
      laid[0]!.rect.height,
    );
  });

  it('draws a thumbnail’s animated background still, painting no frame', () => {
    const { tab, laid } = deck(animated, 'dots');
    const svg = renderTabToSvg(tab, { page: laid[0]!, fontCss: '', stillBackground: true });
    expect(svg).toContain('linearGradient');
    expect(svg).not.toContain(FRAME);
    expect(motionFrameHref).not.toHaveBeenCalled();
  });

  it('embeds nothing for a slide without a motion', () => {
    const { tab, laid } = deck({ kind: 'solid', color: '#ffffff' });
    expect(renderTabToSvg(tab, { page: laid[0]!, fontCss: '' })).not.toContain(FRAME);
    expect(motionFrameHref).not.toHaveBeenCalled();
  });
});
