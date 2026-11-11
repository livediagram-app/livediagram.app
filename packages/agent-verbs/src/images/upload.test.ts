import { afterEach, describe, expect, it, vi } from 'vitest';
import { MAX_IMAGE_BYTES } from '@liveworkspace/media';
import { VerbRefusal } from '../define';
import { fakeApi } from '../testing/product';
import {
  addImage,
  decodeImageData,
  fetchImageUrl,
  IMAGE_FETCH_USER_AGENT,
  nameFromUrl,
  prepareImage,
  uploadToGallery,
  type PreparedImage,
} from './upload';

const WORDS = { list: 'list_images', remove: 'delete_image' };

const be32 = (n: number) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
// The first bytes of a PNG of `w` by `h`: what the sniff and the size reader read.
const png = (w = 64, h = 48) =>
  new Uint8Array([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a,
    ...be32(13),
    0x49,
    0x48,
    0x44,
    0x52,
    ...be32(w),
    ...be32(h),
    8,
    6,
    0,
    0,
    0,
  ]);
const base64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));

// The refusal a call throws, for its words.
async function refusalOf(run: () => unknown): Promise<VerbRefusal> {
  try {
    await run();
  } catch (err) {
    if (err instanceof VerbRefusal) return err;
    throw err;
  }
  throw new Error('no refusal');
}

const stored = (over: Record<string, unknown> = {}) => ({
  id: 'img-1',
  contentType: 'image/png',
  byteSize: 33,
  width: 64,
  height: 48,
  originalName: 'chart.png',
  createdAt: Date.UTC(2026, 10, 11),
  ...over,
});

afterEach(() => vi.unstubAllGlobals());

describe('decodeImageData', () => {
  it('decodes base64, bare or as a data: URL, line breaks and all', () => {
    expect(decodeImageData(base64(png()))).toEqual(png());
    expect(decodeImageData(`data:image/png;base64,${base64(png())}`)).toEqual(png());
    const lines = base64(png()).replace(/(.{8})/g, '$1\n');
    expect(decodeImageData(lines)).toEqual(png());
  });

  it('uses the runtime’s own decoder when it has one', () => {
    const fromBase64 = vi.fn(() => new Uint8Array([1]));
    vi.stubGlobal('Uint8Array', Object.assign(class extends Uint8Array {}, { fromBase64 }));
    expect(decodeImageData('AQ==')).toEqual(new Uint8Array([1]));
    expect(fromBase64).toHaveBeenCalledWith('AQ==');
  });

  it('refuses a data: URL that is not base64, and text that is not base64', async () => {
    expect((await refusalOf(() => decodeImageData('data:image/svg+xml,<svg/>'))).code).toBe(
      'invalid_data',
    );
    const bad = await refusalOf(() => decodeImageData('not*base64!'));
    expect(bad.message).toBe('data is not valid base64.');
  });

  it('leaves the cap to the decoded bytes, so line breaks never count against it', async () => {
    const tooBig = decodeImageData('A'.repeat(Math.ceil(MAX_IMAGE_BYTES / 3) * 4 + 8));
    const refused = await refusalOf(() => prepareImage(tooBig, null));
    expect(refused).toMatchObject({ status: 413, code: 'file_too_large' });
    expect(refused.message).toBe('That picture is 10.0 MB; the gallery takes files up to 10 MB.');
    // Long only for its line breaks: decoded, it fits.
    const wrapped = `${base64(png())}${'\n'.repeat(Math.ceil(MAX_IMAGE_BYTES / 3) * 4)}`;
    expect(decodeImageData(wrapped)).toEqual(png());
  });
});

describe('prepareImage', () => {
  it('judges the bytes by themselves: type, size and name', () => {
    expect(prepareImage(png(1600, 900), '  Q3 chart.png ')).toEqual({
      bytes: png(1600, 900),
      contentType: 'image/png',
      width: 1600,
      height: 900,
      name: 'Q3 chart.png',
    });
    expect(prepareImage(png(), '   ').name).toBeNull();
    expect(prepareImage(png(), null).name).toBeNull();
    expect(prepareImage(png(), 'x'.repeat(300)).name).toHaveLength(200);
  });

  it('refuses an empty file and one over the cap', async () => {
    expect((await refusalOf(() => prepareImage(new Uint8Array(0), null))).code).toBe('empty_file');
    const big = new Uint8Array(MAX_IMAGE_BYTES + 1);
    big.set(png());
    expect(await refusalOf(() => prepareImage(big, null))).toMatchObject({
      status: 413,
      message: 'That picture is 10.0 MB; the gallery takes files up to 10 MB.',
    });
  });

  it('refuses SVG by name, and anything else that is not a picture it takes', async () => {
    const svg = new TextEncoder().encode('\uFEFF  <?xml version="1.0"?><svg onload="x()"/>');
    const refused = await refusalOf(() => prepareImage(svg, 'logo.svg'));
    expect(refused).toMatchObject({ status: 415, code: 'unsupported_type' });
    expect(refused.message).toMatch(/^That is SVG or other markup/);
    expect(refused.hint).toBe('render the SVG to a PNG first');
    const pdf = new TextEncoder().encode('%PDF-1.7 and the rest of it');
    const other = await refusalOf(() => prepareImage(pdf, null));
    expect(other.message).toBe(
      'That is not a picture the gallery takes: it takes PNG, JPEG, WebP or GIF (image/png, image/jpeg, image/webp, image/gif).',
    );
  });

  it('refuses a picture whose header gives no size', async () => {
    const refused = await refusalOf(() => prepareImage(png(0, 0), null));
    expect(refused).toMatchObject({ code: 'unreadable_image' });
    expect(refused.message).toBe('That PNG has no size its header gives, so it looks damaged.');
  });
});

describe('nameFromUrl', () => {
  it('takes the last path segment, decoded when it decodes', () => {
    expect(nameFromUrl('https://a.example.com/img/Q3%20chart.png?x=1')).toBe('Q3 chart.png');
    expect(nameFromUrl('https://a.example.com/img/100%.png')).toBe('100%.png');
    expect(nameFromUrl('https://a.example.com/')).toBeNull();
  });
});

describe('fetchImageUrl', () => {
  const resolve = async () => ['93.184.216.34'];

  it('fetches through the public fetch, asking for the formats the gallery takes', async () => {
    const seen: Request[] = [];
    const got = await fetchImageUrl('https://a.example.com/a.png', {
      resolve,
      fetch: async (request) => {
        seen.push(request);
        return new Response(png());
      },
    });
    expect(got).toEqual({ bytes: png(), url: 'https://a.example.com/a.png' });
    expect(seen[0]!.headers.get('Accept')).toBe('image/png, image/jpeg, image/webp, image/gif');
  });

  it('words each refusal, with the status when there is one', async () => {
    expect(
      await refusalOf(() => fetchImageUrl('https://169.254.169.254/latest', { resolve })),
    ).toMatchObject({
      status: 400,
      code: 'url_private_address',
      message:
        'The URL "https://169.254.169.254/latest" points at a private, loopback, link-local or internal address, which the server never fetches.',
    });
    const missing = await refusalOf(() =>
      fetchImageUrl('https://a.example.com/gone.png', {
        resolve,
        fetch: async () => new Response('', { status: 404 }),
      }),
    );
    expect(missing.message).toBe(
      'The URL "https://a.example.com/gone.png" did not answer with the picture (404).',
    );
    const big = await refusalOf(() =>
      fetchImageUrl('https://a.example.com/big.png', {
        resolve,
        fetch: async () =>
          new Response('', { headers: { 'Content-Length': String(MAX_IMAGE_BYTES + 1) } }),
      }),
    );
    expect(big.status).toBe(413);
  });
});

describe('uploadToGallery', () => {
  const prepared: PreparedImage = {
    bytes: png(),
    contentType: 'image/png',
    width: 64,
    height: 48,
    name: 'Q3 chart.png',
  };

  it('posts the bytes as the caller, naming the tool, and answers the image as list_images lists it', async () => {
    const seen: { headers: Headers; body: Uint8Array }[] = [];
    const api = fakeApi({
      '/images': async (request: Request) => {
        seen.push({
          headers: request.headers,
          body: new Uint8Array(await request.arrayBuffer()),
        });
        return Response.json({ image: stored({ originalName: 'Q3 chart.png' }), deduped: false });
      },
    });
    expect(await uploadToGallery(api, prepared, 'mcp', WORDS)).toEqual({
      id: 'img-1',
      name: 'Q3 chart.png',
      width: 64,
      height: 48,
      size: 33,
      uploadedAt: '2026-11-11T00:00:00.000Z',
      deduped: false,
    });
    const [{ headers, body }] = seen as [(typeof seen)[number]];
    expect(headers.get('Content-Type')).toBe('image/png');
    expect(headers.get('X-Image-Width')).toBe('64');
    expect(headers.get('X-Image-Height')).toBe('48');
    expect(headers.get('X-Image-Source')).toBe('mcp');
    expect(headers.get('X-Image-Original-Name')).toBe('Q3%20chart.png');
    expect(body).toEqual(png());
  });

  it('sends no name when it has none', async () => {
    let named: string | null = 'x';
    const api = fakeApi({
      '/images': (request: Request) => {
        named = request.headers.get('X-Image-Original-Name');
        return Response.json({ image: stored(), deduped: true });
      },
    });
    expect((await uploadToGallery(api, { ...prepared, name: null }, 'cli', WORDS)).deduped).toBe(
      true,
    );
    expect(named).toBeNull();
  });

  const refusing = (status: number, body: unknown) =>
    fakeApi({
      '/images': () =>
        typeof body === 'string' ? new Response(body, { status }) : Response.json(body, { status }),
    });

  it('says how full a full gallery is, by count or by bytes, and how to make room', async () => {
    const byCount = await refusalOf(() =>
      uploadToGallery(
        refusing(403, { error: 'gallery_full', reason: 'count', limit: 100, current: 100 }),
        prepared,
        'mcp',
        WORDS,
      ),
    );
    expect(byCount).toMatchObject({ status: 403, code: 'gallery_full' });
    expect(byCount.message).toBe(
      'The image gallery is full: it holds 100 of its 100 images. Remove pictures it no longer needs with delete_image (list_images lists them), then upload again.',
    );
    const byBytes = await refusalOf(() =>
      uploadToGallery(
        refusing(403, {
          error: 'gallery_full',
          reason: 'bytes',
          limit: 104_857_600,
          current: 104_000_000,
        }),
        prepared,
        'mcp',
        WORDS,
      ),
    );
    expect(byBytes.message).toMatch(
      /^The image gallery is full: it holds 99\.2 MB of its 100\.0 MB\./,
    );
    const bare = await refusalOf(() =>
      uploadToGallery(refusing(403, { error: 'gallery_full' }), prepared, 'mcp', WORDS),
    );
    expect(bare.message).toMatch(/^The image gallery is full: it holds as much as it may\./);
  });

  it('words a file too large and images switched off, and lets anything else through', async () => {
    expect(
      (await refusalOf(() => uploadToGallery(refusing(413, {}), prepared, 'mcp', WORDS))).code,
    ).toBe('file_too_large');
    expect(
      (await refusalOf(() => uploadToGallery(refusing(503, {}), prepared, 'mcp', WORDS))).code,
    ).toBe('images_unavailable');
    await expect(
      uploadToGallery(refusing(403, { error: 'forbidden' }), prepared, 'mcp', WORDS),
    ).rejects.toThrow('api 403');
  });
});

describe('addImage', () => {
  const answering = (requests: Request[] = []) =>
    fakeApi({
      '/images': (request: Request) => {
        requests.push(request);
        return Response.json({
          image: stored({
            originalName: request.headers.get('X-Image-Original-Name') ?? undefined,
          }),
          deduped: false,
        });
      },
    });

  it('uploads base64 data, named as given', async () => {
    const requests: Request[] = [];
    const got = await addImage(
      answering(requests),
      { data: base64(png()), name: 'Logo.png' },
      { source: 'mcp', words: WORDS },
    );
    expect(got.id).toBe('img-1');
    expect(requests[0]!.headers.get('X-Image-Original-Name')).toBe('Logo.png');
    await addImage(answering(requests), { data: base64(png()) }, { source: 'mcp', words: WORDS });
    expect(requests[1]!.headers.has('X-Image-Original-Name')).toBe(false);
  });

  it('uploads bytes already read', async () => {
    const got = await addImage(
      answering(),
      { bytes: png(), name: 'from-disk.png' },
      { source: 'cli', words: WORDS },
    );
    expect(got.name).toBe('from-disk.png');
  });

  it('fetches a URL, named by its file, as itself', async () => {
    const fetched: Request[] = [];
    const requests: Request[] = [];
    const got = await addImage(
      answering(requests),
      { url: 'https://a.example.com/charts/revenue.png' },
      {
        source: 'mcp',
        words: WORDS,
        fetch: {
          resolve: async () => ['93.184.216.34'],
          fetch: async (request) => {
            fetched.push(request);
            return new Response(png());
          },
        },
      },
    );
    expect(got.name).toBe('revenue.png');
    expect(fetched[0]!.headers.get('User-Agent')).toBe(IMAGE_FETCH_USER_AGENT);
    expect(requests[0]!.headers.get('X-Image-Source')).toBe('mcp');
  });

  it('takes data or a url, one of the two', async () => {
    const api = answering();
    for (const from of [{}, { data: 'AA==', url: 'https://a.example.com/a.png' }]) {
      expect(
        (await refusalOf(() => addImage(api, from, { source: 'mcp', words: WORDS }))).code,
      ).toBe('invalid_input');
    }
  });
});
