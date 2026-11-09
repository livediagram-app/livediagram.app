import { describe, expect, it } from 'vitest';
import type { Tab } from '@livehuddle/document';
import type { TabSummary } from '@livehuddle/api-schema';
import { applyTabList, applyTabListOnScreen, tabListOf } from './resync-tab-list';

// docs/specs/012-collaboration/resync-without-reload.md "The tab list": a resync reads the tab list back, so a peer's
// tab added, deleted, renamed or moved during the gap shows without a reload.
const t = (id: string, name = id, elements: Tab['elements'] = []): Tab => ({ id, name, elements });
const s = (id: string, name = id, orderIndex = 0): TabSummary => ({
  id,
  documentId: 'd',
  name,
  orderIndex,
  updatedAt: 1,
});
const box = {
  id: 'e',
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 1,
  height: 1,
} as unknown as Tab['elements'][0];

describe('tabListOf', () => {
  it('is the stored list as a document-meta op, in order', () => {
    expect(
      tabListOf({ name: 'Doc', tabs: [s('a', 'A', 0), { ...s('b', '', 5), outOfScope: true }] }),
    ).toEqual({
      kind: 'document-meta',
      name: 'Doc',
      tabs: [
        { id: 'a', name: 'A', orderIndex: 0 },
        { id: 'b', name: '', orderIndex: 1, outOfScope: true },
      ],
    });
  });

  it('is no list for a document read with no tabs', () => {
    expect(tabListOf({ name: 'Doc', tabs: [] })).toBeNull();
  });
});

describe('applyTabList', () => {
  const list = tabListOf({ name: 'Doc', tabs: [s('b', 'Bee'), s('a', 'Renamed'), s('c', 'New')] })!;

  it("brings a peer's added tab, drops a deleted one and follows the order", () => {
    const tabs = [t('a', 'A', [box]), t('gone'), t('b')];
    const next = applyTabList(tabs, list, new Set(['a']));
    expect(next.map((x) => x.id)).toEqual(['b', 'a', 'c']);
    // A held tab keeps its content and its name (its refetch brings the name); a placeholder takes the stored one.
    expect(next[1]).toBe(tabs[0]);
    expect(next[0]!.name).toBe('Bee');
    expect(next[2]).toMatchObject({ id: 'c', name: 'New', elements: [] });
  });

  it('keeps identity when nothing changed', () => {
    const tabs = [t('b', 'Bee'), t('a', 'Renamed'), t('c', 'New')];
    expect(applyTabList(tabs, list, new Set())).toBe(tabs);
  });

  it('keeps a tab added here and not saved yet, and never brings back one deleted here', () => {
    const saved = [t('a'), t('b'), t('c')];
    // Here: `c` deleted, `mine` added, neither saved.
    const here = [t('a'), t('b'), t('mine')];
    const next = applyTabListOnScreen(here, list, new Set(), saved);
    // `mine` goes back after the tab it followed here.
    expect(next.map((x) => x.id)).toEqual(['b', 'mine', 'a']);
  });
});
