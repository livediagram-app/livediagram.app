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
