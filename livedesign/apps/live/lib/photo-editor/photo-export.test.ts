import { describe, expect, it } from 'vitest';
import { layOutPages, newPhotoPage, type Tab } from '@livedesign/design';
import { PixelsStore } from './pixels-store';
import { allSizesZip, elementsSvg, loadedSession, sizeFileNames } from './photo-export';
import { PhotoSession } from './session';

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

// docs/specs/031-photo/photo-pages.md "Elements on top": exports draw them over the composite.
describe('elementsSvg', () => {
  const page = layOutPages([newPhotoPage('a', 400, 300)])[0]!;
  const r = page.rect;
  const box = (id: string, x: number, y: number) => ({
    id,
    type: 'shape' as const,
    shape: 'square' as const,
    x,
    y,
    width: 40,
    height: 40,
    label: id,
  });
  const tab = (elements: Tab['elements']) =>
    ({
      id: 't',
      name: 'T',
      pages: [page],
      photos: { a: { width: 400, height: 300, layers: [], preview: 'pv-1' } },
      elements,
    }) as unknown as Tab;

  it('draws the elements alone, never the page preview or checkerboard over the photo', () => {
    const images = new Map([['photo:a', { href: 'data:image/png;base64,AAAA' }]]);
    const svg = elementsSvg(tab([box('b1', r.x + 10, r.y + 10)]), page, images)!;
    expect(svg).toContain('b1');
    expect(svg).not.toContain('data:image/png;base64,AAAA');
    expect(elementsSvg(tab([box('b1', r.x + 10, r.y + 10)]), page)).not.toContain('checker');
  });

  it('keeps an arrow with an end on the page, and is null with nothing on it', () => {
    const arrow = {
      id: 'link',
      type: 'arrow' as const,
      from: { kind: 'free' as const, x: r.x + 20, y: r.y + 20 },
      to: { kind: 'free' as const, x: r.x + 120, y: r.y + 20 },
    };
    expect(elementsSvg(tab([arrow]), page)).toContain('<path');
    expect(elementsSvg(tab([box('far', r.x + r.width + 500, r.y)]), page)).toBeNull();
  });
});

describe('loadedSession', () => {
  it('waits for the page in focus to load its tiles before answering it', async () => {
    let arrive: (b: Blob | null) => void = () => {};
    const gate = new Promise<Blob | null>((resolve) => (arrive = resolve));
    const store = new PixelsStore(
      () => gate,
      1 << 20,
      async () => {},
    );
    const photo = {
      width: 1,
      height: 1,
      layers: [
        { id: 'a', name: 'a', layerKind: 'pixel' as const, pixels: { tiles: { '0.0': 'tile-1' } } },
      ],
    };
    const inFocus = new PhotoSession(photo, {
      tabId: 't',
      pageId: 'a',
      store,
      enqueue: () => {},
      commit: () => {},
      checkpoint: () => {},
      cancelCheckpoint: () => {},
      endCheckpoint: () => {},
    });
    expect(inFocus.loading).toBe(true);
    let answered = false;
    const pending = loadedSession({ id: 't' } as Tab, 'a', store, inFocus).then((got) => {
      answered = true;
      return got;
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(answered).toBe(false);
    arrive(null);
    const got = await pending;
    expect(got.session).toBe(inFocus);
    expect(inFocus.loading).toBe(false);
    inFocus.dispose();
  });
});
