import { describe, expect, it } from 'vitest';
import {
  pagesWithSteps,
  parsePageSteps,
  savedPagesOver,
  storedPageList,
  tabPageSteps,
  withinPageCaps,
} from './tab-page-steps';

type Page = { id: string; name?: string };
// A product's `pagesOf` for a tab that stored no pages: one implicit first page.
const fallback = (): Page[] => [{ id: 'page-1' }];
const tab = (...pageIds: string[]) => ({ pages: pageIds.map((id) => ({ id })) });
const ids = (pages: unknown) => (pages as Page[]).map((p) => p.id);

describe('tab page steps', () => {
  it('reads a stored list, skipping entries without an id, or the fallback for a tab with none', () => {
    expect(storedPageList({ pages: [{ id: 'a' }, null, { name: 'x' }] }, fallback)).toEqual([
      { id: 'a' },
    ]);
    expect(storedPageList({}, fallback)).toEqual([{ id: 'page-1' }]);
    expect(storedPageList(undefined, fallback)).toEqual([{ id: 'page-1' }]);
  });

  it('costs nothing when the list is the same object, and removes what a save in flight held', () => {
    const t = tab('a', 'b');
    expect(tabPageSteps(t, t, fallback)).toEqual([]);
    expect(tabPageSteps(t, t, fallback, t)).toEqual([]);
    const after = tab('a');
    expect(tabPageSteps(tab('a'), after, fallback, tab('a', 'n'))).toEqual([
      { kind: 'remove', id: 'n' },
    ]);
  });

  it('applies a peer page change over the local pages, a tab that stored none read through the fallback', () => {
    const steps = tabPageSteps({}, tab('page-1', 'b'), fallback);
    expect(ids(pagesWithSteps({}, steps, tab('page-1', 'b').pages, fallback))).toEqual([
      'page-1',
      'b',
    ]);
  });

  it('stores pages as sent with no steps, as stored with empty steps, else merged over the stored', () => {
    const stored = tab('1', 'A');
    const saved = tab('1', 'B');
    expect(savedPagesOver(stored, saved, undefined, fallback)).toBe(saved.pages);
    expect(savedPagesOver(stored, saved, [], fallback)).toBe(stored.pages);
    expect(savedPagesOver({}, saved, [], fallback)).toBe(saved.pages);
    const steps = tabPageSteps(tab('1'), saved, fallback);
    expect(ids(savedPagesOver(stored, saved, steps, fallback))).toEqual(['1', 'A', 'B']);
  });

  it('reads steps defensively: absent or malformed is null', () => {
    expect(parsePageSteps(undefined)).toBeNull();
    expect(parsePageSteps('x')).toBeNull();
    expect(parsePageSteps([{ kind: 'remove', id: 'a' }])).toEqual([{ kind: 'remove', id: 'a' }]);
  });
});

// collab-race-hardening.md "At the page cap": two Editors one page short of a cap each add one.
describe('the page caps', () => {
  const many = (n: number) => Array.from({ length: n }, (_, i) => `p${String(i).padStart(3, '0')}`);
  const kind = (id: string) => ({ id, kind: id.startsWith('ph') ? 'photo' : 'design' });

  it('keeps the page that landed first, and the rest of the save that no longer fits', () => {
    const base = tab(...many(99));
    const stored = tab(...many(99), 'pA');
    // Hugo renames the first page and adds one: his add no longer fits beside Gwen's, his rename stands.
    const saved = {
      pages: [
        { id: 'p000', name: 'Cover' },
        ...many(99)
          .slice(1)
          .map((id) => ({ id })),
        { id: 'pB' },
      ],
    };
    const steps = tabPageSteps(base, saved, fallback);
    const out = savedPagesOver(stored, saved, steps, fallback, [{ max: 100 }]) as Page[];
    expect(out).toHaveLength(100);
    expect(ids(out)).toContain('pA');
    expect(ids(out)).not.toContain('pB');
    expect(out[0]).toEqual({ id: 'p000', name: 'Cover' });
  });

  it('holds one kind of page to its own cap, by the last added first, and never drops a page already held', () => {
    const counts = (p: { id: string; kind?: string }) => p.kind === 'photo';
    const had = ['ph1', 'ph2', 'd1'].map(kind);
    const pages = ['ph1', 'phX', 'ph2', 'd1', 'phY', 'd2'].map(kind);
    expect(ids(withinPageCaps(pages, had, [{ max: 3, counts }]))).toEqual([
      'ph1',
      'phX',
      'ph2',
      'd1',
      'd2',
    ]);
    expect(ids(withinPageCaps(had, [], [{ max: 1, counts }]))).toEqual(['ph1', 'd1']);
    expect(ids(withinPageCaps(had, had, [{ max: 1, counts }]))).toEqual(ids(had));
  });

  it("leaves a receiver's own page and drops the peer's that would pass the cap", () => {
    const local = tab('p1', 'pA');
    const sent = [{ id: 'p1' }, { id: 'pB' }];
    const steps = tabPageSteps(tab('p1'), { pages: sent }, fallback);
    expect(ids(pagesWithSteps(local, steps, sent, fallback, [{ max: 2 }]))).toEqual(['p1', 'pA']);
    expect(ids(pagesWithSteps(local, steps, sent, fallback))).toEqual(['p1', 'pA', 'pB']);
    expect(ids(pagesWithSteps(local, steps, sent, fallback, [{ max: 3 }]))).toEqual([
      'p1',
      'pA',
      'pB',
    ]);
  });
});
