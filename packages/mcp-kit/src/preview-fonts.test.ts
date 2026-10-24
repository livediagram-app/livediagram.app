import { describe, expect, it, vi } from 'vitest';
import {
  faceUrlsOf,
  INTER_ITALIC,
  previewFonts,
  PREVIEW_FONTS_MAX,
  PREVIEW_FONTS_PENDING_MAX_MS,
  PREVIEW_FONTS_TIMEOUT_MS,
  type PreviewFont,
} from './preview-fonts';

// A product's font table, as its document package's FONTS lists them (livediagram's, for these ids).
const FONTS: readonly PreviewFont[] = [
  { id: 'inter', google: 'Inter:wght@400;500;700' },
  { id: 'caveat', google: 'Caveat:wght@400;500;700' },
  { id: 'oswald', google: 'Oswald:wght@400;500;700' },
  { id: 'poppins', google: 'Poppins:wght@400;500;700' },
  { id: 'nunito', google: 'Nunito:wght@400;500;700' },
  { id: 'lora', google: 'Lora:wght@400;500;700' },
  { id: 'abril-fatface', google: 'Abril+Fatface' },
  { id: 'roboto-slab', google: 'Roboto+Slab:wght@400;500;700' },
  { id: 'permanent-marker', google: 'Permanent+Marker' },
  { id: 'space-grotesk', google: 'Space+Grotesk:wght@400;500;700' },
];

// Each product's docs/specs/015-api/mcp-server.md §5 "Fonts": a preview's faces beyond Inter, from the stylesheet the editor loads.
const css = (family: string) =>
  `@font-face { font-family: '${family}'; src: url(https://fonts.gstatic.com/s/${family}/a.ttf) format('truetype'); }\n` +
  `@font-face { font-family: '${family}'; src: url(https://fonts.gstatic.com/s/${family}/b.ttf) format('truetype'); }`;

function fetcher(fail: Set<string> = new Set()) {
  const calls: string[] = [];
  const fn = vi.fn(async (url: string) => {
    calls.push(url);
    if ([...fail].some((f) => url.includes(f))) return new Response('no', { status: 500 });
    if (url.startsWith('https://fonts.googleapis.com/css2?family=')) {
      const family = decodeURIComponent(url.split('family=')[1]!).split(':')[0]!.toLowerCase();
      return new Response(css(family));
    }
    return new Response(new Uint8Array([1, 2, 3]));
  });
  return { fn, calls };
}

describe('preview fonts', () => {
  it('reads the TrueType files a stylesheet names', () => {
    expect(faceUrlsOf(css('lora'))).toEqual([
      'https://fonts.gstatic.com/s/lora/a.ttf',
      'https://fonts.gstatic.com/s/lora/b.ttf',
    ]);
    expect(faceUrlsOf('nothing')).toEqual([]);
  });

  it('fetches each face a tab uses beyond Inter, once, skipping an unknown id', async () => {
    const { fn, calls } = fetcher();
    const faces = await previewFonts(['inter', 'caveat', 'caveat', 'nope'], FONTS, fn);
    expect(faces).toHaveLength(2);
    expect(calls.filter((c) => c.includes('css2'))).toEqual([
      expect.stringContaining('family=Caveat'),
    ]);
    await previewFonts(['caveat'], FONTS, fn);
    expect(calls.filter((c) => c.includes('css2'))).toHaveLength(1);
    expect(await previewFonts(['inter'], FONTS, fn)).toEqual([]);
  });

  it("fetches Inter's italics when asked, the embedded Inter being upright only", async () => {
    const { fn, calls } = fetcher();
    expect(await previewFonts([INTER_ITALIC], FONTS, fn)).toHaveLength(2);
    expect(calls.filter((c) => c.includes('css2'))).toEqual([
      'https://fonts.googleapis.com/css2?family=Inter:ital,wght@1,400;1,700',
    ]);
  });

  it('fetches at most a few families, and tries a failed one again next time', async () => {
    const { fn } = fetcher(new Set(['Oswald']));
    expect(await previewFonts(['oswald'], FONTS, fn)).toEqual([]);
    const ok = fetcher();
    expect(await previewFonts(['oswald'], FONTS, ok.fn)).toHaveLength(2);
    const many = fetcher();
    await previewFonts(
      ['poppins', 'nunito', 'lora', 'abril-fatface', 'roboto-slab', 'permanent-marker'], FONTS,
      many.fn,
    );
    expect(many.calls.filter((c) => c.includes('css2')).length).toBeLessThanOrEqual(
      PREVIEW_FONTS_MAX,
    );
  });

  it('draws in Inter when the faces are late', async () => {
    vi.useFakeTimers();
    const never = vi.fn(() => new Promise<Response>(() => {}));
    const pending = previewFonts(['space-grotesk'], FONTS, never);
    await vi.advanceTimersByTimeAsync(PREVIEW_FONTS_TIMEOUT_MS + 1);
    expect(await pending).toEqual([]);
    vi.useRealTimers();
  });

  it('draws in Inter when a face’s body fails part way, and fetches it again next time', async () => {
    const broken = vi.fn(async (url: string) => {
      if (url.includes('css2')) return new Response(css('robotoslab'));
      return {
        ok: true,
        clone: () => ({}),
        arrayBuffer: () => Promise.reject(new Error('cut short')),
      } as never;
    });
    await expect(previewFonts(['roboto-slab'], FONTS, broken)).resolves.toEqual([]);
    const ok = fetcher();
    expect(await previewFonts(['roboto-slab'], FONTS, ok.fn)).toHaveLength(2);
  });

  it('starts a fetch of its own once another has hung past its limit', async () => {
    vi.useFakeTimers();
    try {
      const never = vi.fn(() => new Promise<Response>(() => {}));
      const first = previewFonts(['permanent-marker'], FONTS, never);
      await vi.advanceTimersByTimeAsync(PREVIEW_FONTS_TIMEOUT_MS + 1);
      expect(await first).toEqual([]);
      await vi.advanceTimersByTimeAsync(PREVIEW_FONTS_PENDING_MAX_MS);
      const ok = fetcher();
      expect(await previewFonts(['permanent-marker'], FONTS, ok.fn)).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
