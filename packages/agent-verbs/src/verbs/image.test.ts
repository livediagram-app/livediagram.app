import { describe, expect, it } from 'vitest';
import { VerbRefusal } from '../define';
import { contextOf, fakeApi, TEST_PRODUCT } from '../testing/product';
import { createImageVerbs, sizeText } from './image';

const { imageLs, imageAdd, imageRm } = createImageVerbs(TEST_PRODUCT);

const image = (id: string, createdAt: number, originalName: string, byteSize: number) => ({
  id,
  contentType: 'image/png',
  byteSize,
  width: 1280,
  height: 800,
  originalName,
  createdAt,
});

describe('image ls', () => {
  it('lists the gallery newest first, filtered by name, and says when more matched', async () => {
    const api = fakeApi({
      '/images': {
        images: [
          image('a1', 1, 'Screenshot one.png', 512),
          image('b2', 2, 'Screenshot two.png', 245_760),
          image('c3', 3, 'Logo.png', 3_250_000),
        ],
      },
    });
    const hit = await imageLs.run!(
      contextOf(api),
      imageLs.input.parse({ query: 'screenshot', limit: '1' }),
    );
    expect(imageLs.text!(hit)).toEqual([
      'b2  1280x800  240 KB  "Screenshot two.png"',
      '… 1 more; --limit 2, or narrow the name',
    ]);
    expect(imageLs.quiet!(hit)).toEqual(['b2']);
    const all = await imageLs.run!(contextOf(api), imageLs.input.parse({}));
    expect(all.images.map((i) => i.id)).toEqual(['c3', 'b2', 'a1']);
  });

  it('says how pictures get there when there are none', async () => {
    const api = fakeApi({ '/images': {} });
    const none = await imageLs.run!(contextOf(api), imageLs.input.parse({}));
    expect(imageLs.text!(none)).toEqual([
      'no images; upload them in the editor, or with acme image add',
    ]);
  });
});

const be32 = (n: number) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
const PNG = new Uint8Array([
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
  ...be32(64),
  ...be32(48),
  8,
  6,
  0,
  0,
  0,
]);

// The api's answer to an upload, named as it was sent.
const uploads = (sources: string[] = [], deduped = false) =>
  fakeApi({
    '/images': (request: Request) => {
      sources.push(request.headers.get('X-Image-Source') ?? '');
      const name = request.headers.get('X-Image-Original-Name');
      return Response.json({
        image: {
          ...image('n1', 5, name ? decodeURIComponent(name) : '', 33),
          width: 64,
          height: 48,
        },
        deduped,
      });
    },
  });

describe('image add', () => {
  it('uploads a file as the CLI, named by the file, and prints the image', async () => {
    const sources: string[] = [];
    const read: string[] = [];
    const ctx = contextOf(uploads(sources), [], [], {
      readBytes: async (path) => {
        read.push(path);
        return PNG;
      },
    });
    const out = await imageAdd.run!(ctx, imageAdd.input.parse({ source: 'shots/chart.png' }));
    expect(read).toEqual(['shots/chart.png']);
    expect(sources).toEqual(['cli']);
    expect(imageAdd.text!(out)).toEqual(['uploaded n1 64x48 33 B "chart.png"']);
    expect(imageAdd.quiet!(out)).toEqual(['n1']);
    const again = await imageAdd.run!(
      contextOf(uploads([], true), [], [], { readBytes: async () => PNG }),
      imageAdd.input.parse({ source: String.raw`C:\shots\chart.png`, name: 'Chart' }),
    );
    expect(imageAdd.text!(again)).toEqual(['already in the gallery n1 64x48 33 B "Chart"']);
  });

  it('names a file by its own name, and refuses a file where nothing reads one', async () => {
    const windows = await imageAdd.run!(
      contextOf(uploads(), [], [], { readBytes: async () => PNG }),
      imageAdd.input.parse({ source: String.raw`C:\shots\pie.png` }),
    );
    expect(windows.name).toBe('pie.png');
    const refused = await imageAdd.run!(
      contextOf(uploads()),
      imageAdd.input.parse({ source: 'chart.png' }),
    ).catch((err: unknown) => err);
    expect(refused).toBeInstanceOf(VerbRefusal);
    // An http URL is the fetch's to refuse: it never reads a file.
    const insecure = await imageAdd.run!(
      contextOf(uploads()),
      imageAdd.input.parse({ source: 'http://a.example.com/a.png' }),
    ).catch((err: unknown) => err);
    expect(insecure).toMatchObject({ code: 'url_not_https' });
  });
});

describe('image rm', () => {
  const api = () =>
    fakeApi({
      '/images': { images: [image('a1', 1, 'Logo.png', 9), image('b2', 2, 'Hero.png', 9)] },
      '/images/usage': {
        usage: { b2: [{ id: 'd1', name: 'Q3 plan', app: 'livedocuments' }] },
      },
      '/images/a1': { ok: true },
      '/images/b2': { ok: true },
    });

  it('removes what is unused, keeps what is placed, and exits 1 when it kept any', async () => {
    const out = await imageRm.run!(
      contextOf(api()),
      imageRm.input.parse({ ids: ['a1', 'b2', 'z9'] }),
    );
    expect(imageRm.text!(out)).toEqual([
      'deleted a1',
      'kept b2: used in "Q3 plan" (livedocuments); --force removes it',
      'not found z9: not in your gallery',
    ]);
    expect(imageRm.quiet!(out)).toEqual(['a1']);
    expect(imageRm.exitCode!(out)).toBe(1);
  });

  it('removes a placed one when forced, saying where it was used', async () => {
    const out = await imageRm.run!(
      contextOf(api()),
      imageRm.input.parse({ ids: ['b2'], force: true }),
    );
    expect(imageRm.text!(out)).toEqual(['deleted b2 (it was used in "Q3 plan" (livedocuments))']);
    expect(imageRm.exitCode!(out)).toBe(0);
  });
});

describe('its examples', () => {
  it('name the product’s CLI', () => {
    expect(imageLs.cli!.examples).toEqual(['acme image ls', 'acme image ls screenshot --limit 5']);
  });
});

describe('sizeText', () => {
  it('reads bytes, kilobytes and megabytes', () => {
    expect(sizeText(512)).toBe('512 B');
    expect(sizeText(245_760)).toBe('240 KB');
    expect(sizeText(3_250_000)).toBe('3.1 MB');
  });
});
