import { describe, expect, it } from 'vitest';
import type { Tab } from '@livedesign/design';
import { embedTabImages, tabImageIds, type EmbedImageSource } from './embed-images';

// The embedder both workers inline tab images with (docs/specs/015-api/mcp-server.md §5, docs/specs/006-design/design-snapshots.md).
// Each worker passes its own byte source and limits, so these cases pin the
// shared rules: which ids are read, what each limit skips, and what type the
// data URL carries.

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

function tabOf(...ids: string[]): Pick<Tab, 'elements'> {
  return {
    elements: ids.map((imageId, i) => ({
      id: `e${i}`,
      type: 'image',
      imageId,
      x: 0,
      y: 0,
      width: 10,
      height: 10,
    })) as unknown as Tab['elements'],
  };
}

// A source over a fixed table, recording the order ids were read in.
function source(table: Record<string, { bytes: Uint8Array; type: string | null }>) {
  const reads: string[] = [];
  const load: EmbedImageSource = async (id) => {
    reads.push(id);
    const hit = table[id];
    return hit ? { bytes: hit.bytes.slice().buffer, contentType: hit.type } : null;
  };
  return { load, reads };
}

describe('tabImageIds', () => {
  it('lists each referenced image once, in document order, ignoring other elements', () => {
    const tab = tabOf('b', 'a', 'b');
    (tab.elements as unknown[]).push({ id: 'x', type: 'shape' });
    expect(tabImageIds(tab)).toEqual(['b', 'a']);
  });

  it('lists a page’s picture background too, once', () => {
    const tab = {
      ...tabOf('b'),
      pages: [
        {
          id: 'p1',
          orientation: 'landscape',
          background: { fill: { kind: 'image', imageId: 'pic', tone: '#336699' } },
        },
        {
          id: 'p2',
          orientation: 'landscape',
          background: { fill: { kind: 'image', imageId: 'b', tone: '#336699' } },
        },
      ],
    } as never;
    expect(tabImageIds(tab)).toEqual(['b', 'pic']);
  });
});

describe('embedTabImages', () => {
  it('inlines each image as a data URL of its stored type', async () => {
    const { load } = source({ a: { bytes: PNG, type: 'image/png' } });
    const map = await embedTabImages(tabOf('a'), load);
    expect(map.get('a')).toMatch(/^data:image\/png;base64,iVBORw0KGgo/);
  });

  it('sniffs the type when the stored one is missing or not an image type', async () => {
    const { load } = source({
      a: { bytes: JPEG, type: null },
      b: { bytes: PNG, type: 'application/octet-stream' },
    });
    const map = await embedTabImages(tabOf('a', 'b'), load);
    expect(map.get('a')).toMatch(/^data:image\/jpeg;base64,/);
    expect(map.get('b')).toMatch(/^data:image\/png;base64,/);
  });

  it('skips bytes that match no accepted image format when no image type is stored', async () => {
    const { load } = source({ a: { bytes: new Uint8Array(16), type: null } });
    expect((await embedTabImages(tabOf('a'), load)).size).toBe(0);
  });

  it('skips a missing image and one whose read throws', async () => {
    const load: EmbedImageSource = async (id) => {
      if (id === 'boom') throw new Error('read failed');
      return id === 'ok' ? { bytes: PNG.slice().buffer, contentType: 'image/png' } : null;
    };
    const map = await embedTabImages(tabOf('gone', 'boom', 'ok'), load);
    expect([...map.keys()]).toEqual(['ok']);
  });

  it('skips an image over the per-image cap', async () => {
    const { load } = source({
      small: { bytes: PNG, type: 'image/png' },
      big: { bytes: new Uint8Array(100).fill(1), type: 'image/png' },
    });
    const map = await embedTabImages(tabOf('small', 'big'), load, { maxBytesPerImage: 50 });
    expect([...map.keys()]).toEqual(['small']);
  });

  it('spends a total budget in document order, skipping what no longer fits', async () => {
    // 12 + 12 fit a 30-byte budget, the third 12 does not; a later image that
    // still fits is taken, the same as the api's thumbnail always did.
    const tiny = PNG.slice(0, 5); // 5 bytes: fits the 6 left over
    const { load, reads } = source({
      a: { bytes: PNG, type: 'image/png' },
      b: { bytes: PNG, type: 'image/png' },
      c: { bytes: PNG, type: 'image/png' },
      d: { bytes: tiny, type: 'image/png' },
    });
    const map = await embedTabImages(tabOf('a', 'b', 'c', 'd'), load, { totalBudgetBytes: 30 });
    expect([...map.keys()]).toEqual(['a', 'b', 'd']);
    expect(reads).toEqual(['a', 'b', 'c', 'd']);
  });

  it('spends a pixel budget in document order, read from each header, and names what it leaves out', async () => {
    // A PNG header of the given size: the signature, then IHDR's width and height.
    const sized = (w: number, h: number) => {
      const b = new Uint8Array(24);
      b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
      new DataView(b.buffer).setUint32(16, w);
      new DataView(b.buffer).setUint32(20, h);
      return b;
    };
    const { load, reads } = source({
      a: { bytes: sized(100, 50), type: 'image/png' }, // 5,000
      b: { bytes: sized(100, 40), type: 'image/png' }, // 4,000: past the 3,000 left
      c: { bytes: sized(50, 50), type: 'image/png' }, // 2,500: fits
      d: { bytes: PNG, type: 'image/png' }, // no size to read: not drawn, not counted as over
    });
    const over: string[] = [];
    const map = await embedTabImages(tabOf('a', 'b', 'c', 'd'), load, {
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
    await embedTabImages(tabOf('big', 'a', 'b'), load, {
      maxBytesPerImage: 50,
      totalBudgetBytes: 20,
      onOverLimit: (id) => over.push(id),
    });
    expect(over).toEqual(['big', 'b']);
  });
});
