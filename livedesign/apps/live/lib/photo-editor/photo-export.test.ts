import { describe, expect, it } from 'vitest';
import { layOutPages, newPhotoPage, type Tab } from '@livedesign/design';
import { PixelsStore } from './pixels-store';
import { allSizesZip, sizeFileNames } from './photo-export';

// docs/specs/031-photo/photo-pages.md "Exports and other views" All Sizes.
describe('All Sizes', () => {
  it('names each file by its page and its size, a repeat numbered', () => {
    expect(
      sizeFileNames(
        [
          { name: 'Instagram Post', index: 1, width: 1080, height: 1350 },
          { index: 0, width: 4000, height: 3000 },
          { name: 'X/Post', index: 2, width: 1600, height: 900 },
          { name: 'Instagram Post', index: 3, width: 1080, height: 1350 },
          { name: 'Instagram Post', index: 4, width: 1080, height: 1350 },
        ],
        'png',
      ),
    ).toEqual([
      'Instagram Post 1080x1350.png',
      'Page 1 4000x3000.png',
      'X Post 1600x900.png',
      'Instagram Post 1080x1350 2.png',
      'Instagram Post 1080x1350 3.png',
    ]);
  });

  it('zips every photo page at its pixel size, one at a time', async () => {
    const pages = [newPhotoPage('a', 4, 3), { ...newPhotoPage('b', 2, 2), name: 'Instagram Post' }];
    const tab = {
      id: 't',
      elements: [],
      pages,
      photos: {
        a: { width: 4, height: 3, layers: [] },
        b: { width: 2, height: 2, layers: [] },
      },
    } as unknown as Tab;
    const store = new PixelsStore(
      async () => null,
      1 << 20,
      async () => {},
    );
    const scope = { ownerId: 'o', designId: 'd', shareCode: null };
    const file = await allSizesZip(tab, layOutPages(pages), store, null, 'Launch', {
      format: 'png',
      quality: 0.9,
      matte: '#ffffff',
      withElements: false,
      scope,
    });
    expect(file.name).toBe('Launch - All Sizes.zip');
    expect(file.blob.type).toBe('application/zip');
    const text = new TextDecoder('latin1').decode(await file.blob.arrayBuffer());
    expect(text).toContain('Page 1 4x3.png');
    expect(text).toContain('Instagram Post 2x2.png');
    const unnamed = await allSizesZip(tab, layOutPages(pages), store, null, '', {
      format: 'png',
      quality: 0.9,
      matte: '#ffffff',
      withElements: true,
      scope,
    });
    expect(unnamed.name).toBe('Photo - All Sizes.zip');
  });
});
