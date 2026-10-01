import { describe, expect, it, vi } from 'vitest';
import type { ImportImageOutcome, ImportImageSource } from '../import-images';
import type { OpenverseImage } from './openverse';
import { pickFailureMessage, storeSearchResult, type PickStore } from './pick';

// docs/specs/009-elements/blueprints/image-search.md "storeSearchResult".

const result: OpenverseImage = {
  id: 'abc',
  url: 'https://images.example/full.jpg',
  thumbnail: 'https://api.openverse.org/v1/images/abc/thumb/',
  width: 1024,
  height: 768,
  title: 'Rack',
  creator: 'Ada',
  license: 'by',
  licenseVersion: '4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  landingUrl: 'https://images.example/rack',
};

const image = (type = 'image/jpeg') =>
  new Response(new Blob([new Uint8Array([1, 2, 3])], { type }), {
    status: 200,
    headers: { 'content-type': type },
  });

type Route = () => Response | Promise<Response>;
const fetchFrom = (routes: Record<string, Route>) =>
  vi.fn(async (url: string) => {
    const route = routes[url];
    if (!route) throw new TypeError('Failed to fetch');
    return route();
  }) as unknown as typeof fetch;

const stored: ImportImageOutcome = {
  ok: true,
  imageId: 'img-1',
  width: 800,
  height: 600,
  kind: 'uploaded',
};
const storeReturning = (...outcomes: ImportImageOutcome[]) => {
  const store = vi.fn<PickStore>();
  for (const o of outcomes) store.mockResolvedValueOnce(o);
  return store;
};

describe('storeSearchResult', () => {
  it('stores the full picture, named after it, with its credit', async () => {
    const store = storeReturning(stored);
    const fetchImpl = fetchFrom({ [result.url]: () => image() });
    const out = await storeSearchResult(result, store, fetchImpl);
    expect(out).toEqual({
      ok: true,
      picked: {
        id: 'img-1',
        width: 800,
        height: 600,
        originalName: 'Rack',
        credit: {
          text: '"Rack" by Ada, CC BY 4.0',
          sourceUrl: result.landingUrl,
          licenseUrl: result.licenseUrl,
        },
      },
    });
    expect(store).toHaveBeenCalledTimes(1);
    const source = store.mock.calls[0]![0] as ImportImageSource & { kind: 'blob' };
    expect(source).toMatchObject({ kind: 'blob', name: 'Rack' });
    expect(vi.mocked(fetchImpl).mock.calls[0]![1]).toMatchObject({
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
  });

  it('falls back to the thumbnail when the full picture is blocked', async () => {
    const store = storeReturning(stored);
    const fetchImpl = fetchFrom({ [result.thumbnail]: () => image() });
    expect((await storeSearchResult(result, store, fetchImpl)).ok).toBe(true);
    expect(vi.mocked(fetchImpl).mock.calls.map((c) => c[0])).toEqual([
      result.url,
      result.thumbnail,
    ]);
  });

  it('falls back when the host answers with something that is not an image', async () => {
    const store = storeReturning(stored);
    const fetchImpl = fetchFrom({
      [result.url]: () => new Response('<html>', { headers: { 'content-type': 'text/html' } }),
      [result.thumbnail]: () => image(),
    });
    expect((await storeSearchResult(result, store, fetchImpl)).ok).toBe(true);
    expect(store).toHaveBeenCalledTimes(1);
  });

  it('falls back when the pipeline cannot read the full picture', async () => {
    const store = storeReturning({ ok: false, failure: 'unsupported' }, stored);
    const fetchImpl = fetchFrom({ [result.url]: () => image(), [result.thumbnail]: () => image() });
    expect((await storeSearchResult(result, store, fetchImpl)).ok).toBe(true);
    expect(store).toHaveBeenCalledTimes(2);
  });

  it('does not retry a full gallery', async () => {
    const store = storeReturning({ ok: false, failure: 'gallery-full' });
    const fetchImpl = fetchFrom({ [result.url]: () => image(), [result.thumbnail]: () => image() });
    expect(await storeSearchResult(result, store, fetchImpl)).toEqual({
      ok: false,
      failure: 'gallery-full',
    });
    expect(store).toHaveBeenCalledTimes(1);
  });

  it('fails as download-failed when neither picture downloads', async () => {
    const store = storeReturning();
    const fetchImpl = fetchFrom({ [result.thumbnail]: () => new Response('', { status: 404 }) });
    expect(await storeSearchResult(result, store, fetchImpl)).toEqual({
      ok: false,
      failure: 'download-failed',
    });
    expect(store).not.toHaveBeenCalled();
  });
});

describe('pickFailureMessage', () => {
  it('maps failures to the picker copy', () => {
    expect(pickFailureMessage('gallery-full')).toMatch(/gallery is full/);
    expect(pickFailureMessage('images-unavailable')).toMatch(/not available on this server/);
    expect(pickFailureMessage('offline-budget')).toBe('That image is too large to add.');
    expect(pickFailureMessage('download-failed')).toMatch(/Try another one/);
  });
});
