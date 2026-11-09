import { describe, expect, it } from 'vitest';
import type { Tab } from '@livediagram/document';
import { embedTabImages, tabImageIds, type EmbedImageSource } from './embed-images';

// Which ids a tab's images are read by, and that the shared embedder reads them.

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

// The limits, their order and the reads in flight are @liveworkspace/api-kit/embed-images' own suite.
describe('embedTabImages', () => {
  it('embeds the ids the tab references, in document order, within the limits', async () => {
    const { load, reads } = source({
      a: { bytes: PNG, type: 'image/png' },
      b: { bytes: JPEG, type: null },
      c: { bytes: PNG, type: 'image/png' },
    });
    const map = await embedTabImages(tabOf('a', 'b', 'a', 'c'), load, { totalBudgetBytes: 24 });
    expect([...map.keys()]).toEqual(['a', 'b']);
    expect(map.get('b')).toMatch(/^data:image\/jpeg;base64,/);
    expect(reads).toEqual(['a', 'b', 'c']);
  });

  it('takes no limits by default', async () => {
    const { load } = source({ a: { bytes: PNG, type: 'image/png' } });
    expect((await embedTabImages(tabOf('a'), load)).size).toBe(1);
  });
});
