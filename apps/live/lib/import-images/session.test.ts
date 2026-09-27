import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/core';
import { createImportImageSession, type ImportImageSessionDeps } from './session';
import { fakeCodec, PNG_HEAD } from './test-fakes';
import type { ImportImageSource, PreparedImportImage } from './types';
import { IMPORT_IMAGE_CONCURRENCY, OFFLINE_IMPORT_EMBED_BUDGET_CHARS } from './constants';

const pngSource = (fill = 1): ImportImageSource => {
  const bytes = new Uint8Array(64).fill(fill);
  bytes.set(PNG_HEAD);
  return {
    kind: 'data-url',
    dataUrl: `data:image/png;base64,${btoa(String.fromCharCode(...bytes))}`,
  };
};

function deps(over: Partial<ImportImageSessionDeps> = {}): ImportImageSessionDeps {
  return {
    offline: false,
    codec: fakeCodec({ size: { width: 40, height: 20 }, encodedSize: () => 2000 }).codec,
    upload: vi.fn(async () => ({ imageId: 'img-1', deduped: false })),
    toDataUrl: async (blob: Blob) => `data:${blob.type};base64,${'x'.repeat(blob.size)}`,
    log: () => {},
    ...over,
  };
}

describe('createImportImageSession', () => {
  it('uploads a prepared image and reports it as uploaded', async () => {
    const d = deps();
    const out = await createImportImageSession(d).store(pngSource());
    expect(out).toEqual({ ok: true, imageId: 'img-1', width: 40, height: 20, kind: 'uploaded' });
    const prepared = vi.mocked(d.upload).mock.calls[0]![0] as PreparedImportImage;
    expect(prepared.mimeType).toBe('image/png');
  });

  it('reports a server dedupe as deduped', async () => {
    const d = deps({ upload: async () => ({ imageId: 'old', deduped: true }) });
    expect(await createImportImageSession(d).store(pngSource())).toMatchObject({
      ok: true,
      imageId: 'old',
      kind: 'deduped',
    });
  });

  it('keeps trying after the gallery is full, so a duplicate still lands', async () => {
    const upload = vi
      .fn()
      .mockRejectedValueOnce(new ApiError('upload image', 403, 'gallery_full'))
      .mockResolvedValueOnce({ imageId: 'dup', deduped: true });
    const session = createImportImageSession(deps({ upload }));
    expect(await session.store(pngSource(1))).toEqual({ ok: false, failure: 'gallery-full' });
    expect(await session.store(pngSource(2))).toMatchObject({ ok: true, kind: 'deduped' });
    expect(upload).toHaveBeenCalledTimes(2);
  });

  it('short-circuits every later image once the server stores no images', async () => {
    const upload = vi
      .fn()
      .mockRejectedValue(new ApiError('upload image', 503, 'images_unavailable'));
    const d = deps({ upload });
    const session = createImportImageSession(d);
    expect(await session.store(pngSource(1))).toEqual({ ok: false, failure: 'images-unavailable' });
    expect(await session.store(pngSource(2))).toEqual({ ok: false, failure: 'images-unavailable' });
    expect(upload).toHaveBeenCalledTimes(1);
  });

  it('retries once after a 409 upload_conflict (cap race resolved meanwhile)', async () => {
    const upload = vi
      .fn()
      .mockRejectedValueOnce(new ApiError('upload image', 409, 'upload_conflict'))
      .mockResolvedValueOnce({ imageId: 'img-2', deduped: false });
    expect(await createImportImageSession(deps({ upload })).store(pngSource())).toMatchObject({
      ok: true,
      imageId: 'img-2',
      kind: 'uploaded',
    });
    expect(upload).toHaveBeenCalledTimes(2);
  });

  it('leaves a placeholder when the retry conflicts again', async () => {
    const upload = vi.fn().mockRejectedValue(new ApiError('upload image', 409, 'upload_conflict'));
    expect(await createImportImageSession(deps({ upload })).store(pngSource())).toEqual({
      ok: false,
      failure: 'upload-failed',
    });
    expect(upload).toHaveBeenCalledTimes(2);
  });

  it('does not retry other refusals', async () => {
    const upload = vi.fn().mockRejectedValue(new ApiError('upload image', 403, 'gallery_full'));
    await createImportImageSession(deps({ upload })).store(pngSource());
    expect(upload).toHaveBeenCalledTimes(1);
  });

  it('maps a network error to upload-failed', async () => {
    const upload = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    expect(await createImportImageSession(deps({ upload })).store(pngSource())).toEqual({
      ok: false,
      failure: 'upload-failed',
    });
  });

  it('passes source failures through without uploading', async () => {
    const d = deps();
    expect(await createImportImageSession(d).store({ kind: 'data-url', dataUrl: 'nope' })).toEqual({
      ok: false,
      failure: 'unsupported',
    });
    expect(d.upload).not.toHaveBeenCalled();
  });

  it('never rejects, even when a dependency throws unexpectedly', async () => {
    const d = deps({
      toDataUrl: async () => {
        throw new Error('reader broke');
      },
      offline: true,
    });
    expect(await createImportImageSession(d).store(pngSource())).toEqual({
      ok: false,
      failure: 'upload-failed',
    });
  });

  describe('offline diagrams', () => {
    it('embeds the image as a data URL instead of uploading', async () => {
      const d = deps({ offline: true });
      const out = await createImportImageSession(d).store(pngSource());
      expect(out).toMatchObject({ ok: true, kind: 'embedded', width: 40, height: 20 });
      expect(out.ok && out.imageId.startsWith('data:image/png;base64,')).toBe(true);
      expect(d.upload).not.toHaveBeenCalled();
    });

    it('stops embedding at the budget without spending it on the refused image', async () => {
      const big = Math.floor(OFFLINE_IMPORT_EMBED_BUDGET_CHARS * 0.6);
      const sizes = [big, big, 10];
      const d = deps({
        offline: true,
        toDataUrl: async () => 'd'.repeat(sizes.shift()!),
      });
      const session = createImportImageSession(d);
      expect(await session.store(pngSource(1))).toMatchObject({ ok: true, kind: 'embedded' });
      expect(await session.store(pngSource(2))).toEqual({ ok: false, failure: 'offline-budget' });
      expect(await session.store(pngSource(3))).toMatchObject({ ok: true, kind: 'embedded' });
    });
  });

  it(`never runs more than ${IMPORT_IMAGE_CONCURRENCY} images at once`, async () => {
    let active = 0;
    let peak = 0;
    const release: (() => void)[] = [];
    const upload = vi.fn(async () => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise<void>((r) => release.push(r));
      active -= 1;
      return { imageId: 'x', deduped: false };
    });
    const session = createImportImageSession(deps({ upload }));
    const all = Promise.all(Array.from({ length: 7 }, (_, i) => session.store(pngSource(i))));
    // Drain: release whatever is waiting until every store has settled.
    let settled = false;
    void all.then(() => (settled = true));
    while (!settled) {
      await new Promise((r) => setTimeout(r, 0));
      release.splice(0).forEach((r) => r());
    }
    expect(upload).toHaveBeenCalledTimes(7);
    expect(peak).toBe(IMPORT_IMAGE_CONCURRENCY);
  });

  it('logs one line per outcome with the fingerprint', async () => {
    const log = vi.fn();
    await createImportImageSession(deps({ log })).store(pngSource());
    expect(log).toHaveBeenCalledWith(
      '[import-images]',
      'uploaded',
      expect.objectContaining({ mimeType: 'image/png', sourceBytes: 64 }),
    );
  });
});
