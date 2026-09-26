import { describe, expect, it } from 'vitest';
import type { Tab } from '@livediagram/diagram';
import { embedTabImages, tabImageIds, type EmbedImageSource } from './embed-images';

// The embedder both workers inline tab images with (spec/62 §5, spec/67).
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
});
