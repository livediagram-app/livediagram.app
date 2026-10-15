// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import {
  createImageInliner,
  inlineCssUrls,
  inlineMedia,
  TRANSPARENT_PIXEL,
} from './snapshot-media';

// docs/specs/020-import-export/blueprints/animated-gif-export.md "The snapshot", step 4.
const okFetch = () =>
  vi.fn(
    // Bytes plus a content type, not a Blob: jsdom's Blob is not Node's, and Node 24's Response stringifies it.
    async (src: string) =>
      new Response(new TextEncoder().encode(src), { headers: { 'content-type': 'image/png' } }),
  ) as unknown as typeof fetch;

describe('inlining pictures', () => {
  it('reads a picture once per export, however often it repeats', async () => {
    const fetchImpl = okFetch();
    const images = createImageInliner(fetchImpl);
    const [a, b] = await Promise.all([images.dataUrl('blob:x'), images.dataUrl('blob:x')]);
    expect(a).toMatch(/^data:image\/png;base64,/);
    expect(b).toBe(a);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('leaves a picture it cannot read empty, never failing the export', async () => {
    const images = createImageInliner(
      (async () => new Response('', { status: 404 })) as unknown as typeof fetch,
    );
    await expect(images.dataUrl('/gone.png')).resolves.toBe(TRANSPARENT_PIXEL);
    const offline = createImageInliner((async () =>
      Promise.reject(new TypeError('offline'))) as typeof fetch);
    await expect(offline.dataUrl('/x.png')).resolves.toBe(TRANSPARENT_PIXEL);
  });

  it('passes data: URLs through', async () => {
    const fetchImpl = okFetch();
    await expect(createImageInliner(fetchImpl).dataUrl('data:a')).resolves.toBe('data:a');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('swaps every url() in a style for its data: URL', async () => {
    const images = { dataUrl: async (u: string) => `data:${u}` };
    await expect(
      inlineCssUrls('background-image: url("blob:a"), url(b.png); mask: url(data:z)', images),
    ).resolves.toBe('background-image: url("data:blob:a"), url("data:b.png"); mask: url(data:z)');
  });

  it('gives the clone its pictures, canvases and embeds as images', async () => {
    const live = document.createElement('div');
    live.innerHTML =
      '<img src="/a.png" srcset="/a2.png 2x" loading="lazy"><canvas class="c" width="4" height="2"></canvas>' +
      '<iframe class="f" style="width:10px"></iframe><span style="background:url(/bg.png)"></span><i></i>';
    const clone = live.cloneNode(true) as HTMLElement;
    const images = { dataUrl: async (u: string) => `data:${u.replace(/^https?:\/\/[^/]+/, '')}` };
    const liveNodes = [...live.querySelectorAll('*')];
    const twins = [...clone.querySelectorAll('*')];
    HTMLCanvasElement.prototype.toDataURL = () => 'data:canvas';
    await inlineMedia(liveNodes, twins, images, (el) => el.localName === 'i');
    const img = clone.querySelector('img')!;
    expect(img.getAttribute('src')).toBe('data:/a.png');
    expect(img.hasAttribute('srcset')).toBe(false);
    expect(img.hasAttribute('loading')).toBe(false);
    expect(clone.querySelector('canvas')).toBeNull();
    expect(clone.querySelector('img.c')?.getAttribute('src')).toBe('data:canvas');
    expect(clone.querySelector('iframe')).toBeNull();
    expect(clone.querySelector('img.f')?.getAttribute('style')).toBe('width:10px');
    expect(clone.querySelector('span')?.getAttribute('style')).toBe(
      'background:url("data:/bg.png")',
    );
  });

  it('gives an SVG picture its data: URL, a video its poster, and a canvas it cannot read nothing', async () => {
    const live = document.createElement('div');
    live.innerHTML =
      '<svg><image xlink:href="/pic.png"></image></svg><video class="v" poster="/poster.png"></video><canvas></canvas>';
    const clone = live.cloneNode(true) as HTMLElement;
    const images = { dataUrl: async (u: string) => `data:${u.replace(/^https?:\/\/[^/]+/, '')}` };
    HTMLCanvasElement.prototype.toDataURL = () => {
      throw new DOMException('tainted', 'SecurityError');
    };
    await inlineMedia(
      [...live.querySelectorAll('*')],
      [...clone.querySelectorAll('*')],
      images,
      () => false,
    );
    expect(clone.querySelector('image')?.getAttribute('href')).toBe('data:/pic.png');
    expect(clone.querySelector('image')?.hasAttribute('xlink:href')).toBe(false);
    expect(clone.querySelector('img.v')?.getAttribute('src')).toBe('data:/poster.png');
    expect(clone.querySelector('video')).toBeNull();
    expect(clone.querySelector('canvas')).toBeNull();
    expect([...clone.querySelectorAll('img')].map((i) => i.getAttribute('src'))).toContain(
      TRANSPARENT_PIXEL,
    );
  });
});
