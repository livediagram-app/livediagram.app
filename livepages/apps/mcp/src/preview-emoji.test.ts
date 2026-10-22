import { describe, expect, it, vi } from 'vitest';
import type { Element } from '@livepages/document';
import {
  emojiGlyphsOf,
  previewEmoji,
  PREVIEW_EMOJI_MAX,
  PREVIEW_EMOJI_TIMEOUT_MS,
  TWEMOJI_BASE,
} from './preview-emoji';

// docs/specs/015-api/mcp-server.md §5 "Fonts": a preview's emoji drawn from their Twemoji art, fetched by code point.
const box = { x: 0, y: 0, width: 80, height: 80 };
const el = (id: string, extra: object) => ({ id, type: 'shape', ...box, ...extra }) as Element;
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path d="M0 0"/></svg>';

describe('preview emoji', () => {
  it('finds the emoji a tab draws: stickers, emoji icons and reaction pads, once each', () => {
    expect(
      emojiGlyphsOf([
        el('a', { shape: 'sticker', stickerId: 'emoji-thumbs-up' }),
        el('b', { shape: 'icon', iconId: 'emoji-thumbs-up' }),
        el('c', { shape: 'icon', iconId: 'clock' }),
        el('d', { shape: 'reaction-pad', reaction: 'applause' }),
        el('e', { shape: 'reaction-pad' }),
        el('f', { shape: 'square' }),
        { id: 'g', type: 'text', ...box, label: '🚀' },
      ]),
    ).toEqual(['👍', '👏', '🎉']);
  });

  it('fetches each emoji by its Twemoji name and reads its art, leaving out one that fails', async () => {
    const fetcher = vi.fn(async (url: string) =>
      url.endsWith('1f44d.svg') ? new Response(SVG) : new Response('Not Found', { status: 404 }),
    );
    const art = await previewEmoji(['👍', '🔥'], fetcher);
    expect(fetcher).toHaveBeenCalledWith(`${TWEMOJI_BASE}1f44d.svg`);
    expect([...art.keys()]).toEqual(['👍']);
    expect(art.get('👍')).toEqual({ viewBox: '0 0 36 36', markup: '<path d="M0 0"/>' });
  });

  it('fetches nothing for no emoji, and at most PREVIEW_EMOJI_MAX', async () => {
    const fetcher = vi.fn(async () => new Response(SVG));
    expect((await previewEmoji([], fetcher)).size).toBe(0);
    expect(fetcher).not.toHaveBeenCalled();
    const many = Array.from({ length: PREVIEW_EMOJI_MAX + 5 }, (_, i) =>
      String.fromCodePoint(0x1f600 + i),
    );
    await previewEmoji(many, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(PREVIEW_EMOJI_MAX);
  });

  it('keeps an oversized or broken answer out, and a thrown fetch', async () => {
    const big = `<svg viewBox="0 0 36 36">${'<path/>'.repeat(20_000)}</svg>`;
    const fetcher = vi.fn(async (url: string) => {
      if (url.endsWith('1f600.svg')) return new Response(big);
      if (url.endsWith('1f601.svg')) throw new Error('offline');
      return new Response('<html>oops</html>');
    });
    expect((await previewEmoji(['😀', '😁', '😂'], fetcher)).size).toBe(0);
  });

  it('draws with what arrived when the rest are late', async () => {
    vi.useFakeTimers();
    try {
      const fetcher = vi.fn((url: string) =>
        url.endsWith('1f44d.svg')
          ? Promise.resolve(new Response(SVG))
          : new Promise<Response>(() => undefined),
      );
      const pending = previewEmoji(['👍', '🐢'], fetcher);
      await vi.advanceTimersByTimeAsync(PREVIEW_EMOJI_TIMEOUT_MS);
      expect([...(await pending).keys()]).toEqual(['👍']);
    } finally {
      vi.useRealTimers();
    }
  });
});
