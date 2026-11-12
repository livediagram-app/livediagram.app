import { describe, expect, it } from 'vitest';
import type { Page } from './page';
import type { Tab } from './index';
import {
  mergeSaveOverStored,
  pageStepsOf,
  parseTabSaveChanges,
  tabSaveChanges,
  withPeerPageSteps,
} from './tab-save-changes';

// What a save merges over the stored tab (docs/specs/012-collaboration/collab-race-hardening.md "A save is merged
// with the stored tab"): two Editors' saves from one baseline, landing one after the other, keep both pages (#669).

const logo = (id: string, name?: string): Page => ({
  id,
  orientation: 'landscape',
  ...(name ? { name } : {}),
});
const tab = (pages?: Page[]): Tab => ({
  id: 't1',
  name: 'Logos',
  elements: [],
  ...(pages ? { pages } : {}),
});
const ids = (pages: readonly Page[] | undefined) => (pages ?? []).map((p) => p.id);
const save = (before: Tab, after: Tab, previous?: Tab) => ({
  tab: after,
  changes: parseTabSaveChanges(
    JSON.parse(JSON.stringify(tabSaveChanges(before, after, previous))) as Record<string, unknown>,
  )!,
});

describe('two Editors adding a page at once (#669)', () => {
  const base = tab([logo('p1'), logo('p2')]);
  const gwen = tab([logo('p1'), logo('p2'), logo('pA')]);
  const hugo = tab([logo('p1'), logo('p2'), logo('pB')]);

  it('stores both pages whichever save lands last, in the order each screen shows', () => {
    const gwenFirst = mergeSaveOverStored(
      mergeSaveOverStored(base, gwen, save(base, gwen).changes),
      hugo,
      save(base, hugo).changes,
    );
    const hugoFirst = mergeSaveOverStored(
      mergeSaveOverStored(base, hugo, save(base, hugo).changes),
      gwen,
      save(base, gwen).changes,
    );
    expect(ids(gwenFirst.pages)).toEqual(['p1', 'p2', 'pA', 'pB']);
    expect(ids(hugoFirst.pages)).toEqual(ids(gwenFirst.pages));
    expect(ids(withPeerPageSteps(gwen, pageStepsOf(base, hugo), hugo.pages)!)).toEqual(
      ids(gwenFirst.pages),
    );
    expect(ids(withPeerPageSteps(hugo, pageStepsOf(base, gwen), gwen.pages)!)).toEqual(
      ids(gwenFirst.pages),
    );
  });

  it('keeps the stored copy of a page the save did not change, and removes one a save in flight added', () => {
    const stored = tab([logo('p1', 'Hugo'), logo('p2'), logo('pX')]);
    const before = tab([logo('p1'), logo('p2')]);
    const previous = tab([logo('p1'), logo('p2'), logo('pX')]);
    const out = mergeSaveOverStored(stored, before, save(before, before, previous).changes);
    expect(out.pages).toEqual([logo('p1', 'Hugo'), logo('p2')]);
  });

  it('stores pages as sent without steps, and keeps none when neither side has any', () => {
    expect(mergeSaveOverStored(base, gwen, {}).pages).toBe(gwen.pages);
    expect(mergeSaveOverStored(tab(), tab(), { pages: [] }).pages).toBeUndefined();
  });

  it('takes an older sender whole, and reads a request defensively', () => {
    expect(withPeerPageSteps(gwen, undefined, hugo.pages)).toBeNull();
    expect(withPeerPageSteps(gwen, [], 'x')).toBeNull();
    expect(parseTabSaveChanges(null)).toBeNull();
    expect(parseTabSaveChanges({ pages: 5 })).toBeNull();
    expect(parseTabSaveChanges({ pages: [] })).toEqual({ pages: [] });
  });
});

// A photo page's picture is `photos[pageId]`, merged by page beside the pages (collab-race-hardening.md "A save is
// merged with the stored tab", Work Tracker #717).
describe('two Editors and a photo page', () => {
  const photoPage = (id: string): Page => ({ id, orientation: 'landscape', kind: 'photo' });
  const photo = (w: number) => ({ width: w, height: 480, layers: [] });
  const withPhotos = (pages: Page[], photos: Record<string, ReturnType<typeof photo>>): Tab => ({
    ...tab(pages),
    photos,
  });
  const base = withPhotos([logo('p1'), photoPage('ph1')], { ph1: photo(640) });

  it("keeps a peer's photo page and its picture whichever save lands last", () => {
    const gwen = withPhotos([logo('p1'), photoPage('ph1'), photoPage('phA')], {
      ph1: photo(640),
      phA: photo(800),
    });
    const hugo = withPhotos([logo('p1'), photoPage('ph1'), logo('pB')], { ph1: photo(1024) });
    for (const [first, last] of [
      [gwen, hugo],
      [hugo, gwen],
    ] as const) {
      const stored = mergeSaveOverStored(
        mergeSaveOverStored(base, first, save(base, first).changes),
        last,
        save(base, last).changes,
      );
      expect(ids(stored.pages)).toEqual(['p1', 'ph1', 'pB', 'phA']);
      expect(stored.photos).toEqual({ ph1: photo(1024), phA: photo(800) });
    }
  });

  it("removes a picture the save removed, or whose page went, and a save in flight's", () => {
    const gone = withPhotos([logo('p1')], {});
    expect(mergeSaveOverStored(base, gone, save(base, gone).changes).photos).toBeUndefined();
    const orphan = withPhotos([logo('p1')], { ph1: photo(640) });
    expect(mergeSaveOverStored(orphan, tab([logo('p1')]), { pages: [] }).photos).toBeUndefined();
    const previous = withPhotos([logo('p1'), photoPage('ph1'), photoPage('phX')], {
      ph1: photo(640),
      phX: photo(1),
    });
    const stored = mergeSaveOverStored(base, previous, save(base, previous).changes);
    expect(save(base, base, previous).changes.photos).toEqual(['phX']);
    expect(mergeSaveOverStored(stored, base, save(base, base, previous).changes).photos).toEqual({
      ph1: photo(640),
    });
  });

  it('takes every saved picture over the stored ones when the header names none, and reads photos defensively', () => {
    const peer = withPhotos([logo('p1'), photoPage('ph1'), photoPage('phP')], {
      ph1: photo(640),
      phP: photo(2),
    });
    const mine = withPhotos([logo('p1'), photoPage('ph1'), photoPage('phP')], { ph1: photo(9) });
    expect(mergeSaveOverStored(peer, mine, { pages: [] }).photos).toEqual({
      ph1: photo(9),
      phP: photo(2),
    });
    expect(parseTabSaveChanges({ photos: ['ph1'] })).toEqual({ photos: ['ph1'] });
    expect(parseTabSaveChanges({ photos: [''] })).toBeNull();
    expect(parseTabSaveChanges({ photos: 'ph1' })).toBeNull();
  });
});

// collab-race-hardening.md "At the page cap": two Editors one page short of a cap each add one (#717).
describe('two Editors at a page cap', () => {
  const photoPage = (id: string): Page => ({ id, orientation: 'landscape', kind: 'photo' });
  const race = (base: Tab, gwen: Tab, hugo: Tab) =>
    mergeSaveOverStored(
      mergeSaveOverStored(base, gwen, save(base, gwen).changes),
      hugo,
      save(base, hugo).changes,
    );

  it('keeps 100 pages: the first add to land, and the rest of the later save', () => {
    const pages = Array.from({ length: 99 }, (_, i) => logo(`p${String(i).padStart(3, '0')}`));
    const base = tab(pages);
    const gwen = tab([...pages, logo('pA')]);
    const hugo = tab([logo('p000', 'Cover'), ...pages.slice(1), logo('pB')]);
    const stored = race(base, gwen, hugo);
    expect(stored.pages).toHaveLength(100);
    expect(ids(stored.pages)).toContain('pA');
    expect(ids(stored.pages)).not.toContain('pB');
    expect(stored.pages![0]).toEqual(logo('p000', 'Cover'));
    expect(withPeerPageSteps(gwen, pageStepsOf(base, hugo), hugo.pages)).toHaveLength(100);
  });

  it('keeps 10 photo pages, and a design page the same save added', () => {
    const photos = Array.from({ length: 9 }, (_, i) => photoPage(`ph${i}`));
    const base = tab(photos);
    const gwen = tab([...photos, photoPage('phA')]);
    const hugo = tab([...photos, photoPage('phB'), logo('pB')]);
    const stored = race(base, gwen, hugo);
    expect(stored.pages!.filter((p) => p.kind === 'photo')).toHaveLength(10);
    expect(ids(stored.pages)).toEqual([...ids(photos), 'phA', 'pB']);
  });
});
