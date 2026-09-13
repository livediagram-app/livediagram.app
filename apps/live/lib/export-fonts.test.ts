import { describe, expect, it, vi } from 'vitest';
import { embeddedFontFaceCss, latinFaceBlocks } from './export-fonts';

// An export leaves the browser that made it: a font-family the reader hasn't
// got installed paints as the fallback, and the PNG path rasterises through
// an <img>, where an external @import is blocked outright. So the bytes come
// with the file (spec/28).
const GOOGLE_CSS = `
/* cyrillic */
@font-face {
  font-family: 'Permanent Marker';
  src: url(https://fonts.gstatic.com/s/pm/cyrillic.woff2) format('woff2');
  unicode-range: U+0301;
}
/* latin-ext */
@font-face {
  font-family: 'Permanent Marker';
  src: url(https://fonts.gstatic.com/s/pm/latin-ext.woff2) format('woff2');
  unicode-range: U+0100;
}
/* latin */
@font-face {
  font-family: 'Permanent Marker';
  src: url(https://fonts.gstatic.com/s/pm/latin.woff2) format('woff2');
  unicode-range: U+0000-00FF;
}
`;

function stubFetch() {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('fonts.googleapis.com')) {
      return new Response(GOOGLE_CSS, { status: 200 });
    }
    if (url.endsWith('.woff2')) {
      return new Response(new Uint8Array([1, 2, 3, 4]), { status: 200 });
    }
    return new Response('nope', { status: 404 });
  }) as unknown as typeof fetch;
}

describe('latinFaceBlocks', () => {
  it('keeps the Latin subsets and drops the rest', () => {
    const blocks = latinFaceBlocks(GOOGLE_CSS);
    expect(blocks).toHaveLength(2);
    expect(blocks.join()).toContain('latin.woff2');
    expect(blocks.join()).toContain('latin-ext.woff2');
    expect(blocks.join()).not.toContain('cyrillic.woff2');
  });
});

describe('embeddedFontFaceCss', () => {
  it('inlines each font file as a data URL', async () => {
    const css = await embeddedFontFaceCss(['permanent-marker'], stubFetch());
    expect(css).toContain('@font-face');
    expect(css).toContain("font-family: 'Permanent Marker'");
    expect(css).toContain('data:font/woff2;base64,');
    expect(css).not.toContain('https://fonts.gstatic.com');
  });

  it('asks for nothing when no face was used', async () => {
    const fetchImpl = stubFetch();
    expect(await embeddedFontFaceCss([], fetchImpl)).toBe('');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('degrades to the system fallback rather than failing the export', async () => {
    const dead = vi.fn(
      async () => new Response('down', { status: 503 }),
    ) as unknown as typeof fetch;
    expect(await embeddedFontFaceCss(['lora'], dead)).toBe('');
    const throws = vi.fn(async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    expect(await embeddedFontFaceCss(['oswald'], throws)).toBe('');
  });

  it('downloads a face once, however many exports ask for it', async () => {
    const fetchImpl = stubFetch();
    await embeddedFontFaceCss(['caveat'], fetchImpl);
    const callsAfterFirst = (fetchImpl as unknown as { mock: { calls: unknown[] } }).mock.calls
      .length;
    await embeddedFontFaceCss(['caveat'], fetchImpl);
    expect((fetchImpl as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(
      callsAfterFirst,
    );
  });
});
