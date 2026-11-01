import { describe, expect, it } from 'vitest';
import {
  layOutPages,
  newPhotoPage,
  pageDimensions,
  pageHasOrientation,
  pageKindOf,
  pageLabel,
  pageMargin,
  pagesOf,
  pageSizesFor,
  photoSheetSides,
  withPages,
} from './page';
import type { Page } from './page';

describe('photo pages (docs/specs/031-photo/photo-pages.md "A photo page")', () => {
  it('sizes the sheet to the picture, at most 2048 canvas px, never scaled up', () => {
    expect(photoSheetSides(1920, 1080)).toEqual({ width: 1920, height: 1080 });
    expect(photoSheetSides(8000, 4000)).toEqual({ width: 2048, height: 1024 });
    expect(photoSheetSides(100, 9000)).toEqual({ width: 23, height: 2048 });
    expect(photoSheetSides(1, 8192)).toEqual({ width: 1, height: 2048 });
  });

  it('makes a new photo page in the photo size, facing its picture', () => {
    expect(newPhotoPage('page-a')).toEqual({
      id: 'page-a',
      orientation: 'landscape',
      size: 'photo',
      fit: { width: 1920, height: 1080 },
      kind: 'photo',
    });
    expect(newPhotoPage('page-b', 1080, 1920).orientation).toBe('portrait');
  });

  it('reads a stored photo page: its sides kept, a background dropped, a bad size defaulted', () => {
    const [page] = pagesOf({
      pages: [
        {
          id: 'p1',
          orientation: 'portrait',
          kind: 'photo',
          size: 'a4',
          fit: { width: 400, height: 300 },
          background: { fill: { kind: 'solid', colour: '#ff0000' } },
          name: 'Holiday',
          locked: true,
        },
      ],
    });
    expect(page).toEqual({
      id: 'p1',
      orientation: 'landscape',
      size: 'photo',
      fit: { width: 400, height: 300 },
      name: 'Holiday',
      kind: 'photo',
      locked: true,
    });
    const [bad] = pagesOf({ pages: [{ id: 'p2', orientation: 'portrait', kind: 'photo' }] });
    expect(bad!.fit).toEqual({ width: 1920, height: 1080 });
    // The photo size is a photo page's alone.
    const [other] = pagesOf({
      pages: [{ id: 'p3', orientation: 'portrait', size: 'photo', fit: { width: 9, height: 9 } }],
    });
    expect(other!.size).toBeUndefined();
  });

  it('answers its kind, dimensions, sizes, orientation, margin and label', () => {
    const p = newPhotoPage('page-c', 4000, 3000);
    expect(pageKindOf(p)).toBe('photo');
    expect(pageDimensions(p)).toEqual({ width: 2048, height: 1536 });
    expect(pageSizesFor('photo')).toEqual(['photo']);
    expect(pageHasOrientation(p)).toBe(false);
    expect(pageMargin(p)).toBe(0);
    expect(pageLabel(p, 0, 1, { width: 4000, height: 3000 })).toBe('4000 x 3000 · Photo');
    expect(pageLabel({ ...p, name: 'Sky' }, 1, 2, { width: 4000, height: 3000 })).toBe(
      'Sky · 4000 x 3000 · Photo',
    );
    expect(pageLabel(p, 1, 2)).toBe('Page 2 · Photo');
    expect(layOutPages([p])[0]!.rect).toEqual({ x: -1024, y: -768, width: 2048, height: 1536 });
  });

  it("drops a removed page's photo, keeping the others", () => {
    const a = newPhotoPage('pa');
    const b = newPhotoPage('pb');
    const photo = { width: 10, height: 10, layers: [] };
    const tab = { elements: [], pages: [a, b], photos: { pa: photo, pb: photo } };
    const next = withPages(tab, [a]);
    expect(Object.keys(next.photos)).toEqual(['pa']);
    const none = withPages(tab, []);
    expect(none).not.toHaveProperty('photos');
    const same = withPages(tab, [a, b]);
    expect(same.photos).toBe(tab.photos);
  });
});

describe('photo page edits', () => {
  // Imported here to keep the page-model tests above about page.ts alone.
  it('adds, duplicates and chooses photo pages, each with its picture', async () => {
    const {
      pageAdded,
      pageDuplicated,
      withPageKindChosen,
      photoOfPage,
      withPhoto,
      withoutPhoto,
      roomForPhotoPage,
      blankPhoto,
      photosOf,
      newPhotoPage,
    } = await import('./index');
    // A photo tab: every page of a tab is one kind (docs/specs/007-editor/pages-mode.md).
    const base: { elements: never[]; pages: Page[]; photos?: Record<string, unknown> } = {
      elements: [],
      pages: [newPhotoPage('p0')],
    };
    const added = pageAdded(base, 'photo', 'p1', undefined, { width: 4000, height: 2000 });
    if (!('tab' in added)) throw new Error('refused');
    const page = added.tab.pages.find((p) => p.id === 'p1')!;
    expect(page).toMatchObject({
      kind: 'photo',
      size: 'photo',
      fit: { width: 2048, height: 1024 },
    });
    expect(photoOfPage(added.tab, 'p1')).toEqual({ width: 4000, height: 2000, layers: [] });
    // A page with no stored photo reads as the default one.
    expect(photoOfPage(base, 'p0')).toEqual(blankPhoto());
    const copy = pageDuplicated(added.tab, 'p1', 'p2');
    if (!('tab' in copy)) throw new Error('refused');
    expect(photoOfPage(copy.tab, 'p2')).toEqual(photoOfPage(added.tab, 'p1'));
    // Resizing the photo turns its sheet and moves the pages after it.
    const resized = withPhoto(copy.tab, 'p1', { width: 1000, height: 2000, layers: [] });
    expect(resized.pages.find((p) => p.id === 'p1')).toMatchObject({
      orientation: 'portrait',
      fit: { width: 1000, height: 2000 },
    });
    const logos = {
      elements: [],
      pages: [{ id: 'l', orientation: 'portrait' as const, kind: 'logo' as const }],
    };
    expect(withPhoto(logos, 'l', blankPhoto())).toBe(logos);
    expect(pageAdded(logos, 'photo', 'n')).toEqual({ refused: 'kind_not_offered' });
    expect(withPhoto(copy.tab, 'p1', photoOfPage(copy.tab, 'p1')).pages).toBe(copy.tab.pages);
    expect(Object.keys(photosOf(withoutPhoto(copy.tab, 'p1')))).toEqual(['p2']);
    expect(withoutPhoto(withoutPhoto(copy.tab, 'p1'), 'p2')).not.toHaveProperty('photos');
    expect(withoutPhoto(base, 'p0')).toBe(base);
    const fresh = {
      elements: [],
      pages: [{ id: 'q', orientation: 'portrait' as const, name: 'Mine' }],
    };
    const chosen = withPageKindChosen(fresh, 'q', 'photo')!;
    expect(chosen.pages[0]).toMatchObject({ id: 'q', kind: 'photo', name: 'Mine' });
    expect(photoOfPage(chosen, 'q')).toEqual(blankPhoto());
    // At most ten photo pages.
    let tab: typeof added.tab = added.tab;
    for (let i = 0; i < 9; i++) {
      const next = pageAdded(tab, 'photo', `x${i}`);
      if ('tab' in next) tab = next.tab;
    }
    expect(roomForPhotoPage(tab)).toBe(false);
    expect(pageAdded(tab, 'photo', 'one-more')).toEqual({ refused: 'photo_limit' });
    expect(pageDuplicated(tab, 'p1', 'one-more')).toEqual({ refused: 'photo_limit' });
  });

  it('adds Make Sizes pages after their source, named, with their photos, as one edit', async () => {
    const { photoPagesAdded, photoOfPage, newPhotoPage } = await import('./index');
    const base = {
      elements: [],
      pages: [newPhotoPage('a'), newPhotoPage('b')],
    };
    const post = { width: 1080, height: 1350, layers: [] };
    const banner = { width: 1584, height: 396, layers: [] };
    const out = photoPagesAdded(base, 'a', [
      { id: 'n1', name: 'Instagram Post', photo: post },
      { id: 'n2', name: 'LinkedIn Banner', photo: banner },
    ]);
    if (!('tab' in out)) throw new Error('refused');
    expect(out.tab.pages.map((p) => p.id)).toEqual(['a', 'n1', 'n2', 'b']);
    expect(out.tab.pages.find((p) => p.id === 'n1')).toMatchObject({
      name: 'Instagram Post',
      kind: 'photo',
      orientation: 'portrait',
      fit: { width: 1080, height: 1350 },
    });
    expect(photoOfPage(out.tab, 'n2')).toEqual(banner);
    // Nothing to add is the same pages back.
    expect(photoPagesAdded(base, 'b', [])).toEqual({ tab: base });
    expect(photoPagesAdded(base, 'gone', [{ id: 'n', name: 'X', photo: post }])).toEqual({
      refused: 'unknown_page',
    });
    // One past the ten photo pages refuses them all.
    const many = Array.from({ length: 9 }, (_, i) => ({
      id: `m${i}`,
      name: 'X Post',
      photo: post,
    }));
    expect(photoPagesAdded(base, 'a', many)).toEqual({ refused: 'photo_limit' });
  });
});

describe('a photo page in exports', () => {
  it('draws its composite where given, else the checkerboard, and is transparent', async () => {
    const { renderPageToSvg, pageExportFrame } = await import('./index');
    const page = {
      ...newPhotoPage('ph', 400, 200),
      index: 0,
      rect: { x: 0, y: 0, width: 400, height: 200 },
    };
    const tab = { id: 't', name: 't', elements: [], pages: [page] };
    const drawn = renderPageToSvg(tab, page, {
      resolvePhotoHref: (id) => (id === 'ph' ? 'data:image/png;base64,AAAA' : undefined),
    });
    expect(drawn).toContain('href="data:image/png;base64,AAAA"');
    const none = renderPageToSvg(tab, page);
    expect(none).toContain('-checker');
    expect(pageExportFrame(page).transparent).toBe(true);
  });
});
