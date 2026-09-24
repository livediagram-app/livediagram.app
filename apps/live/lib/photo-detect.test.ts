// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PHOTO_MAX_EDGE_PX } from '@livediagram/api-schema';
import { eventStormingNote } from '@livediagram/diagram';
import { detectAndCrop, photoTypeError, PhotoDetectFailed } from './photo-detect';
import { boundaryCuesFor } from './photo-model/client';

// The boundary model runs in a worker jsdom does not have; its answer is
// stubbed per test, and by default it is unavailable.
vi.mock('./photo-model/client', () => ({
  boundaryCuesFor: vi.fn(),
  warmBoundaryModel: vi.fn(),
}));

// Everything the browser does with a photograph before anything is sent
// (spec/139 Phase 8). jsdom has no canvas, so the drawing surface is stubbed
// and made to hand back pixels WE control — which means the detector really
// runs here, on an image this test drew, and only the encoder is a stand-in.

type Painted = { width: number; height: number; pixels: (x: number, y: number) => number[] };

// A working image with one orange sticky in the middle of a pale wall.
function oneSticky(width: number, height: number): Painted {
  const fill = eventStormingNote('domain-event').fill;
  const paper = [
    parseInt(fill.slice(1, 3), 16),
    parseInt(fill.slice(3, 5), 16),
    parseInt(fill.slice(5, 7), 16),
  ];
  return {
    width,
    height,
    pixels: (x, y) =>
      x > width * 0.25 && x < width * 0.75 && y > height * 0.25 && y < height * 0.75
        ? paper
        : [241, 245, 249],
  };
}

// The same scene as a camera sees it: a few levels of sensor noise on every
// pixel, so no two neighbours are exactly equal.
function photographed(scene: Painted): Painted {
  return {
    ...scene,
    pixels: (x, y) =>
      scene.pixels(x, y).map((v, c) => {
        const n = Math.sin(x * 12.9898 + y * 78.233 + c * 37.719) * 43758.5453;
        return Math.max(0, Math.min(255, v + Math.round((n - Math.floor(n)) * 8) - 4));
      }),
  };
}

const blankWall: Painted = { width: 64, height: 64, pixels: () => [241, 245, 249] };

function stubImaging(bitmap: { width: number; height: number } | 'throw', painted?: Painted) {
  const created: ImageBitmapOptions[] = [];
  const encoded: { w: number; h: number }[] = [];
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async (_file: Blob, opts?: ImageBitmapOptions) => {
      created.push(opts ?? {});
      if (bitmap === 'throw') throw new Error('decode failed');
      return { ...bitmap, close: vi.fn() } as unknown as ImageBitmap;
    }),
  );
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag !== 'canvas') return document.createElementNS('http://www.w3.org/1999/xhtml', tag);
    const canvas = { width: 0, height: 0 } as unknown as HTMLCanvasElement & {
      width: number;
      height: number;
    };
    Object.assign(canvas, {
      getContext: () => ({
        drawImage: vi.fn(),
        getImageData: (_x: number, _y: number, w: number, h: number) => {
          const source = painted ?? blankWall;
          const data = new Uint8ClampedArray(w * h * 4);
          for (let y = 0; y < h; y += 1) {
            for (let x = 0; x < w; x += 1) {
              // Sample the painted image at the same relative position.
              const [r, g, b] = source.pixels(
                Math.floor((x / w) * source.width),
                Math.floor((y / h) * source.height),
              ) as [number, number, number];
              const i = (y * w + x) * 4;
              data[i] = r;
              data[i + 1] = g;
              data[i + 2] = b;
              data[i + 3] = 255;
            }
          }
          return { data, width: w, height: h };
        },
      }),
      toDataURL: () => {
        encoded.push({ w: canvas.width, h: canvas.height });
        return `data:image/jpeg;base64,${'A'.repeat(64)}`;
      },
    });
    return canvas;
  });
  return { created, encoded };
}

const file = (type = 'image/jpeg') => new File([new Uint8Array([1])], 'wall.jpg', { type });

beforeEach(() => {
  vi.restoreAllMocks();
  vi.mocked(boundaryCuesFor).mockResolvedValue({ ok: false, reason: 'no-worker' });
});
afterEach(() => vi.unstubAllGlobals());

describe('photoTypeError', () => {
  it('accepts the three formats the wire contract accepts', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
      expect(photoTypeError(type), type).toBeNull();
    }
  });

  it('calls out HEIC by name — it is the iPhone default and the advice differs', () => {
    expect(photoTypeError('image/heic')).toBe('photo_unsupported_heic');
    expect(photoTypeError('image/heif')).toBe('photo_unsupported_heic');
  });

  it('refuses everything else, GIF and SVG included', () => {
    expect(photoTypeError('image/gif')).toBe('photo_unsupported_type');
    expect(photoTypeError('image/svg+xml')).toBe('photo_unsupported_type');
  });
});

describe('detectAndCrop', () => {
  it('refuses a HEIC before touching the decoder', async () => {
    const { created } = stubImaging({ width: 100, height: 100 });
    await expect(detectAndCrop(file('image/heic'))).rejects.toMatchObject({
      reason: 'photo_unsupported_heic',
    });
    expect(created).toHaveLength(0);
  });

  it('honours the EXIF orientation flag, so a phone photo is upright BEFORE detection', async () => {
    const { created } = stubImaging({ width: 400, height: 300 }, oneSticky(400, 300));
    await detectAndCrop(file());
    expect(created[0]).toEqual({ imageOrientation: 'from-image' });
  });

  it('detects on a downscaled working copy, keeping the aspect', async () => {
    const out = await withStub({ width: 4000, height: 3000 }, oneSticky(400, 300));
    expect(out.imageSize.width).toBe(PHOTO_MAX_EDGE_PX);
    expect(out.imageSize.height).toBe(Math.round((PHOTO_MAX_EDGE_PX * 3000) / 4000));
  });

  it('never upscales a small photo', async () => {
    const out = await withStub({ width: 640, height: 480 }, oneSticky(640, 480));
    expect(out.imageSize).toEqual({ width: 640, height: 480 });
  });

  it('finds the sticky and cuts exactly one crop for it', async () => {
    const out = await withStub({ width: 400, height: 300 }, oneSticky(400, 300));
    expect(out.stickies).toHaveLength(1);
    expect(out.stickies[0]!.kind).toBe('domain-event');
    expect(out.crops).toHaveLength(1);
    expect(out.crops[0]!.id).toBe(out.stickies[0]!.id);
    expect(out.crops[0]!.image.startsWith('data:image/jpeg;base64,')).toBe(true);
    // The review overlay (step 1 of the wizard) draws the working photo the
    // boxes were found in, so it rides along too.
    expect(out.photoUrl.startsWith('data:image/jpeg;base64,')).toBe(true);
  });

  it('keeps the working photo for review even when there is no paper in it', async () => {
    const out = await withStub({ width: 200, height: 200 }, blankWall);
    expect(out.stickies).toEqual([]);
    expect(out.crops).toEqual([]);
    expect(out.photoUrl.startsWith('data:image/jpeg;base64,')).toBe(true);
  });

  it('reports an undecodable file rather than throwing something raw', async () => {
    stubImaging('throw');
    await expect(detectAndCrop(file())).rejects.toBeInstanceOf(PhotoDetectFailed);
    await expect(detectAndCrop(file())).rejects.toMatchObject({ reason: 'photo_unreadable' });
  });
});

describe('detectAndCrop with the boundary model', () => {
  it("hands the model's cues to the detector, and says the hybrid ran", async () => {
    // A model that sees only background drops the one box the colour found:
    // proof the cues reached the detector.
    vi.mocked(boundaryCuesFor).mockImplementation(async (image) => ({
      ok: true,
      backend: 'wasm',
      cues: {
        width: image.width,
        height: image.height,
        notes: [],
        background: new Uint8Array(image.width * image.height).fill(255),
      },
    }));
    const out = await withStub({ width: 400, height: 300 }, photographed(oneSticky(400, 300)));
    expect(boundaryCuesFor).toHaveBeenCalledWith(
      expect.objectContaining({ width: 400, height: 300 }),
    );
    expect(out.stickies).toEqual([]);
    expect(out.detector).toEqual({ path: 'hybrid', backend: 'wasm' });
  });

  it('runs the classical detector alone when the model fails, and says why', async () => {
    vi.mocked(boundaryCuesFor).mockResolvedValue({ ok: false, reason: 'timeout' });
    const out = await withStub({ width: 400, height: 300 }, photographed(oneSticky(400, 300)));
    expect(out.stickies).toHaveLength(1);
    expect(out.detector).toEqual({ path: 'classical', reason: 'timeout' });
  });

  it('never lets the model reject the import', async () => {
    vi.mocked(boundaryCuesFor).mockRejectedValue(new Error('worker went away'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const out = await withStub({ width: 400, height: 300 }, photographed(oneSticky(400, 300)));
    expect(out.stickies).toHaveLength(1);
    expect(out.detector).toEqual({ path: 'classical', reason: 'inference-failed' });
  });

  it('does not ask the model about a flat drawing, and says so', async () => {
    // The model learnt photographs; a screenshot or a drawn wall is flat to
    // the bit, and the classical detector reads it alone.
    vi.mocked(boundaryCuesFor).mockImplementation(async (image) => ({
      ok: true,
      backend: 'wasm',
      cues: {
        width: image.width,
        height: image.height,
        notes: [],
        background: new Uint8Array(image.width * image.height).fill(255),
      },
    }));
    const out = await withStub({ width: 400, height: 300 }, oneSticky(400, 300));
    expect(boundaryCuesFor).not.toHaveBeenCalled();
    expect(out.stickies).toHaveLength(1);
    expect(out.detector).toEqual({ path: 'classical', reason: 'flat-image' });
  });
});

async function withStub(
  bitmap: { width: number; height: number },
  painted: Painted,
): ReturnType<typeof detectAndCrop> {
  stubImaging(bitmap, painted);
  return detectAndCrop(file());
}
