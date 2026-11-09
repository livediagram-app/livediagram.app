import { describe, expect, it } from 'vitest';
import { imagePixelSize } from '@liveworkspace/api-schema/image-size';
import { sniffImageType } from '@liveworkspace/api-schema/image-sniff';
import { bytesToBase64 } from './bytes';
import {
  EMBED_IMAGE_CONCURRENCY,
  embedImages,
  type EmbedImageLimits,
  type EmbedImageSource,
} from './embed-images';

// The embedder every product's api and mcp inline images with (each product's docs/specs/015-api/mcp-server.md §5
// and its snapshots spec). Each worker passes its own byte source and limits, so these cases pin the shared rules:
// which ids are read, what each limit skips, what type the data URL carries, and that reading several at a time
// answers what reading one at a time did.

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

// A PNG header of the given size: the signature, then IHDR's width and height.
const sized = (w: number, h: number, pad = 0) => {
  const b = new Uint8Array(24 + pad);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(b.buffer).setUint32(16, w);
  new DataView(b.buffer).setUint32(20, h);
  return b;
};

type Table = Record<string, { bytes: Uint8Array; type: string | null } | 'throw'>;

// A source over a fixed table, recording the order ids were read in.
function source(table: Table) {
  const reads: string[] = [];
  const load: EmbedImageSource = async (id) => {
    reads.push(id);
    const hit = table[id];
    if (hit === 'throw') throw new Error('read failed');
    return hit ? { bytes: hit.bytes.slice().buffer, contentType: hit.type } : null;
  };
  return { load, reads };
}

// The embedder as it was before reads overlapped (each product's api-schema embed-images.ts, verbatim but for the
// ids): one read at a time in document order whenever a budget was set.
async function serial(ids: string[], load: EmbedImageSource, limits: EmbedImageLimits) {
  const map = new Map<string, string>();
  const { maxBytesPerImage = Infinity, totalBudgetBytes, totalBudgetPixels, onOverLimit } = limits;
  let budget = totalBudgetBytes ?? Infinity;
  let pixelBudget = totalBudgetPixels ?? Infinity;
  const embedOne = async (id: string): Promise<void> => {
    let loaded: Awaited<ReturnType<EmbedImageSource>>;
    try {
      loaded = await load(id);
    } catch {
      return;
    }
    if (!loaded) return;
    const size = loaded.bytes.byteLength;
    if (size > maxBytesPerImage || size > budget) {
      onOverLimit?.(id);
      return;
    }
    const bytes = new Uint8Array(loaded.bytes);
    const type = loaded.contentType?.startsWith('image/')
      ? loaded.contentType
      : sniffImageType(bytes);
    if (!type) return;
    let pixels = 0;
    if (totalBudgetPixels !== undefined) {
      const dims = imagePixelSize(bytes);
      if (!dims) return;
      pixels = dims.width * dims.height;
      if (pixels > pixelBudget) {
        onOverLimit?.(id);
        return;
      }
    }
    budget -= size;
    pixelBudget -= pixels;
    map.set(id, `data:${type};base64,${bytesToBase64(bytes)}`);
  };
  for (const id of ids) await embedOne(id);
  return map;
}

// A seeded random (mulberry32), so a failing case can be replayed.
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('embedImages', () => {
  it('inlines each image as a data URL of its stored type', async () => {
    const { load } = source({ a: { bytes: PNG, type: 'image/png' } });
    const map = await embedImages(['a'], load);
    expect(map.get('a')).toMatch(/^data:image\/png;base64,iVBORw0KGgo/);
  });

  it('reads nothing for no ids', async () => {
    const { load, reads } = source({});
    expect((await embedImages([], load)).size).toBe(0);
    expect(reads).toEqual([]);
  });

  it('sniffs the type when the stored one is missing or not an image type', async () => {
    const { load } = source({
      a: { bytes: JPEG, type: null },
      b: { bytes: PNG, type: 'application/octet-stream' },
    });
    const map = await embedImages(['a', 'b'], load);
    expect(map.get('a')).toMatch(/^data:image\/jpeg;base64,/);
    expect(map.get('b')).toMatch(/^data:image\/png;base64,/);
  });

  it('skips bytes that match no accepted image format when no image type is stored', async () => {
    const { load } = source({ a: { bytes: new Uint8Array(16), type: null } });
    expect((await embedImages(['a'], load)).size).toBe(0);
  });

  it('skips a missing image and one whose read throws', async () => {
    const { load } = source({ boom: 'throw', ok: { bytes: PNG, type: 'image/png' } });
    const map = await embedImages(['gone', 'boom', 'ok'], load);
    expect([...map.keys()]).toEqual(['ok']);
  });

  it('skips an image over the per-image cap', async () => {
    const { load } = source({
      small: { bytes: PNG, type: 'image/png' },
      big: { bytes: new Uint8Array(100).fill(1), type: 'image/png' },
    });
    const map = await embedImages(['small', 'big'], load, { maxBytesPerImage: 50 });
    expect([...map.keys()]).toEqual(['small']);
  });

  it('spends a total budget in document order, skipping what no longer fits', async () => {
    // 12 + 12 fit a 30-byte budget, the third 12 does not; a later image that still fits is taken.
    const tiny = PNG.slice(0, 5); // 5 bytes: fits the 6 left over
    const { load, reads } = source({
      a: { bytes: PNG, type: 'image/png' },
      b: { bytes: PNG, type: 'image/png' },
      c: { bytes: PNG, type: 'image/png' },
      d: { bytes: tiny, type: 'image/png' },
    });
    const map = await embedImages(['a', 'b', 'c', 'd'], load, { totalBudgetBytes: 30 });
    expect([...map.keys()]).toEqual(['a', 'b', 'd']);
    expect(reads).toEqual(['a', 'b', 'c', 'd']);
  });

  it('spends a pixel budget in document order, read from each header, and names what it leaves out', async () => {
    const { load, reads } = source({
      a: { bytes: sized(100, 50), type: 'image/png' }, // 5,000
      b: { bytes: sized(100, 40), type: 'image/png' }, // 4,000: past the 3,000 left
      c: { bytes: sized(50, 50), type: 'image/png' }, // 2,500: fits
      d: { bytes: PNG, type: 'image/png' }, // no size to read: not drawn, not counted as over
    });
    const over: string[] = [];
    const map = await embedImages(['a', 'b', 'c', 'd'], load, {
      totalBudgetPixels: 8_000,
      onOverLimit: (id) => over.push(id),
    });
    expect([...map.keys()]).toEqual(['a', 'c']);
    expect(over).toEqual(['b']);
    expect(reads).toEqual(['a', 'b', 'c', 'd']);
  });

  it('names an image over the per-image cap or past the byte budget', async () => {
    const { load } = source({
      big: { bytes: new Uint8Array(100).fill(1), type: 'image/png' },
      a: { bytes: PNG, type: 'image/png' },
      b: { bytes: PNG, type: 'image/png' },
    });
    const over: string[] = [];
    await embedImages(['big', 'a', 'b'], load, {
      maxBytesPerImage: 50,
      totalBudgetBytes: 20,
      onOverLimit: (id) => over.push(id),
    });
    expect(over).toEqual(['big', 'b']);
  });

  it('judges in document order however the reads land, and holds the budget as one at a time did', async () => {
    // Later images land first: b and c are over the budget a leaves, though both fit when they land.
    const delays: Record<string, number> = { a: 30, b: 0, c: 10, d: 5 };
    const bytes: Record<string, Uint8Array> = {
      a: sized(10, 10, 16), // 40 bytes
      b: sized(10, 10, 6), // 30 bytes: past the 20 a leaves
      c: sized(10, 10, 1), // 25 bytes: past it too
      d: sized(10, 10), // 24 bytes: past it too
    };
    const load: EmbedImageSource = (id) =>
      new Promise((resolve) =>
        setTimeout(
          () => resolve({ bytes: bytes[id]!.slice().buffer, contentType: 'image/png' }),
          delays[id],
        ),
      );
    const over: string[] = [];
    const map = await embedImages(['a', 'b', 'c', 'd'], load, {
      totalBudgetBytes: 60,
      onOverLimit: (id) => over.push(id),
    });
    expect([...map.keys()]).toEqual(['a']);
    expect(over).toEqual(['b', 'c', 'd']);
  });

  it(`reads at most ${EMBED_IMAGE_CONCURRENCY} at a time, starting them in document order`, async () => {
    const ids = Array.from({ length: 20 }, (_, i) => `i${i}`);
    let inFlight = 0;
    let most = 0;
    const started: string[] = [];
    const load: EmbedImageSource = async (id) => {
      started.push(id);
      inFlight++;
      most = Math.max(most, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 1 + (Number(id.slice(1)) % 3)));
      inFlight--;
      return { bytes: PNG.slice().buffer, contentType: 'image/png' };
    };
    const map = await embedImages(ids, load, { totalBudgetBytes: 12 * 15 });
    expect(most).toBe(EMBED_IMAGE_CONCURRENCY);
    expect(started).toEqual(ids);
    expect([...map.keys()]).toEqual(ids.slice(0, 15));
  });

  it('answers what reading one at a time did, on random tabs and limits', async () => {
    const random = seeded(20261108);
    for (let run = 0; run < 200; run++) {
      const count = Math.floor(random() * 14);
      const ids = Array.from({ length: count }, (_, i) => `i${i}`);
      const table: Table = {};
      for (const id of ids) {
        const roll = random();
        if (roll < 0.1) continue; // missing
        if (roll < 0.15) table[id] = 'throw';
        else if (roll < 0.2)
          table[id] = { bytes: new Uint8Array(30), type: null }; // no format
        else if (roll < 0.25)
          table[id] = { bytes: PNG, type: 'image/png' }; // no size to read
        else
          table[id] = {
            bytes: sized(
              1 + Math.floor(random() * 60),
              1 + Math.floor(random() * 60),
              Math.floor(random() * 80),
            ),
            type: random() < 0.5 ? 'image/png' : null,
          };
      }
      const limits = (over: string[]): EmbedImageLimits => ({
        ...(random() < 0.5 ? { maxBytesPerImage: 30 + Math.floor(random() * 80) } : {}),
        ...(random() < 0.7 ? { totalBudgetBytes: Math.floor(random() * 400) } : {}),
        ...(random() < 0.5 ? { totalBudgetPixels: Math.floor(random() * 6000) } : {}),
        onOverLimit: (id) => over.push(id),
      });
      const delays = new Map(ids.map((id) => [id, Math.floor(random() * 4)]));
      const overA: string[] = [];
      const overB: string[] = [];
      const limitsA = limits(overA);
      const limitsB = { ...limitsA, onOverLimit: (id: string) => overB.push(id) };
      // Reads land in a shuffled order for the window, in order for the serial reference.
      const delayed: EmbedImageSource = async (id) => {
        await new Promise((resolve) => setTimeout(resolve, delays.get(id)));
        return source(table).load(id);
      };
      const fast = await embedImages(ids, delayed, limitsA);
      const plain = await serial(ids, source(table).load, limitsB);
      expect([...fast], `run ${run}`).toEqual([...plain]);
      expect(overA, `run ${run}`).toEqual(overB);
    }
  });
});
