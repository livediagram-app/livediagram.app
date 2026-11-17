import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { sniffsAs } from '@livedesign/api-schema';
import { loadPhotoEditSample, SAMPLE_FILES, SAMPLE_IDS } from './photo-edit-sample-load';

// docs/specs/031-photo/photo-pages.md "The Photo Edit template": the files, fetched only when picked and checked.
const fromDisk = async (url: URL) => new Response(readFileSync(fileURLToPath(url)));

describe('the Photo Edit sample files', () => {
  it('are the bytes their ids name, of the type they say, small enough to fetch at a pick', async () => {
    const sample = await loadPhotoEditSample(fromDisk);
    expect(sample?.ids).toEqual(SAMPLE_IDS);
    expect(sample!.entries.map((e) => e.id)).toEqual(SAMPLE_FILES.map((f) => f.id));
    for (const e of sample!.entries) expect(sniffsAs(e.bytes, e.type), e.id).toBe(true);
    // About 130 KB in all (photo-pages.md); a budget so a heavier file is a choice, not an accident.
    const total = sample!.entries.reduce((n, e) => n + e.bytes.length, 0);
    expect(total).toBeLessThan(160_000);
  });

  it('fetches each file from where the bundler put it', async () => {
    const f = vi.fn(fromDisk);
    vi.stubGlobal('fetch', f);
    expect(await loadPhotoEditSample()).not.toBeNull();
    expect(f).toHaveBeenCalledTimes(SAMPLE_FILES.length);
    vi.unstubAllGlobals();
  });

  it('is none at all when a file fails to come or is not the file', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await loadPhotoEditSample(async () => new Response(null, { status: 404 }))).toBeNull();
    expect(
      await loadPhotoEditSample(async (url) =>
        url.pathname.endsWith('lakeside.jpg')
          ? new Response(new Uint8Array([0xff, 0xd8, 0xff, 0]))
          : fromDisk(url),
      ),
    ).toBeNull();
    expect(
      await loadPhotoEditSample(async () => {
        throw new TypeError('offline');
      }),
    ).toBeNull();
    expect(warn).toHaveBeenCalledWith('[photo] sample-unavailable', expect.anything());
    warn.mockRestore();
  });
});
