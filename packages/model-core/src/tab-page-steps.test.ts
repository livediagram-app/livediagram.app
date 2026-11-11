import { describe, expect, it } from 'vitest';
import {
  pagesWithSteps,
  parsePageSteps,
  savedPagesOver,
  storedPageList,
  tabPageSteps,
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
