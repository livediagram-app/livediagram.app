import { describe, expect, it } from 'vitest';
import type { Tab } from '@livediagram/diagram';
import { dataUrlToFile, isDataImageId, rewriteImageIds } from './offline-images';

// 1x1 transparent PNG.
const PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

function tab(elements: Tab['elements']): Tab {
  return { id: 't1', name: 'Tab 1', elements } as Tab;
}

function imageEl(id: string, imageId: string | null) {
  return { id, type: 'image', x: 0, y: 0, width: 100, height: 80, imageId } as Tab['elements'][0];
}

describe('isDataImageId', () => {
  it('matches data URIs and nothing else', () => {
    expect(isDataImageId(PNG_DATA_URL)).toBe(true);
    expect(isDataImageId('img_abc123')).toBe(false);
    expect(isDataImageId(null)).toBe(false);
    expect(isDataImageId(undefined)).toBe(false);
  });
});

describe('rewriteImageIds', () => {
  it('swaps mapped ids, leaves unmapped + non-image elements alone', () => {
    const tabs = [
      tab([
        imageEl('a', 'img_1'),
        imageEl('b', 'img_2'),
        imageEl('c', null),
        { id: 'd', type: 'shape', shape: 'square', x: 0, y: 0, width: 10, height: 10 } as never,
      ]),
    ];
    const out = rewriteImageIds(tabs, new Map([['img_1', PNG_DATA_URL]]));
    const els = out[0]!.elements as { id: string; imageId?: string | null }[];
    expect(els.find((e) => e.id === 'a')!.imageId).toBe(PNG_DATA_URL);
    expect(els.find((e) => e.id === 'b')!.imageId).toBe('img_2');
    expect(els.find((e) => e.id === 'c')!.imageId).toBeNull();
    // Untouched elements keep identity (no needless re-renders / saves).
    expect(els.find((e) => e.id === 'b')).toBe(tabs[0]!.elements[1]);
  });

  it('returns the input array untouched for an empty mapping', () => {
    const tabs = [tab([imageEl('a', 'img_1')])];
    expect(rewriteImageIds(tabs, new Map())).toBe(tabs);
  });
});

describe('dataUrlToFile', () => {
  it('decodes a base64 data URL into a typed File', async () => {
    const file = dataUrlToFile(PNG_DATA_URL);
    expect(file).not.toBeNull();
    expect(file!.type).toBe('image/png');
    const bytes = new Uint8Array(await file!.arrayBuffer());
    // PNG magic number survives the round trip.
    expect([...bytes.slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });

  it('rejects non-base64 / malformed data URLs', () => {
    expect(dataUrlToFile('data:image/png,notbase64')).toBeNull();
    expect(dataUrlToFile('img_abc')).toBeNull();
    expect(dataUrlToFile('data:image/png;base64,!!!not-b64!!!')).toBeNull();
  });
});
