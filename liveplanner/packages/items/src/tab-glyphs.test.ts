import { describe, expect, it } from 'vitest';
import { ITEM_TYPES, type ItemTypeDef } from './item-types';
import {
  DETAILS_GLYPH_DEFAULT,
  HIDDEN_TAB_GLYPH,
  OVERVIEW_TAB_GLYPH,
  TAB_GLYPH_DEFAULT,
  detailsGlyphOf,
  tabGlyphOf,
  withDetailsGlyph,
  withTabGlyph,
} from './tab-glyphs';
import { isPlanGlyphId } from './glyphs';
import { OVERVIEW_TAB_ID, tabsOf, validateItemTypeCatalogue } from './type-catalogue';
import { inheritFrom, withInheritance } from './type-inheritance';
import { ITEM_TYPE_KEYS, NEWER_KEYS_MAX_BYTES, newerKeysOf } from './stored-keys';

// docs/specs/026-plan/item-types.md "Tab icons" (Work Tracker 858) and "Settings from a newer version" (Work Tracker
// 368).
const task: ItemTypeDef = ITEM_TYPES.find((t) => t.id === 'task')!;
const withTabs = (over: Partial<ItemTypeDef> = {}): ItemTypeDef => ({
  ...task,
  tabs: [
    { id: OVERVIEW_TAB_ID, label: 'Overview', fields: ['description'] },
    { id: 't-design', label: 'Design', fields: ['checklist'] },
  ],
  ...over,
});
const read = (types: unknown[], newerFields: 'keep' | 'refuse' = 'keep') => {
  const r = validateItemTypeCatalogue({ version: 1, types }, { newerFields });
  if (!r.ok) throw new Error(r.reason);
  return r.catalogue.types;
};

describe('tab icons', () => {
  it('defaults Overview to the page, Details to the checklist and a new tab to the kanban', () => {
    expect([OVERVIEW_TAB_GLYPH, DETAILS_GLYPH_DEFAULT, TAB_GLYPH_DEFAULT]).toEqual([
      'page',
      'checklist',
      'kanban',
    ]);
    const [overview, design] = tabsOf(withTabs());
    expect(tabGlyphOf(overview!)).toBe('page');
    expect(tabGlyphOf(design!)).toBe('kanban');
    expect(detailsGlyphOf(task)).toBe('checklist');
    // A type with no tabs of its own draws its one Overview tab with the page.
    expect(tabGlyphOf(tabsOf(task)[0]!)).toBe('page');
    expect(isPlanGlyphId(HIDDEN_TAB_GLYPH)).toBe(true);
  });

  it('wears a chosen icon, and reads an unknown one as the default', () => {
    expect(tabGlyphOf({ id: 't-risks', glyph: 'risk' })).toBe('risk');
    expect(tabGlyphOf({ id: 't-risks', glyph: 'nope' as never })).toBe('kanban');
    expect(detailsGlyphOf({ detailsGlyph: 'info' })).toBe('info');
  });

  it('stores a chosen icon, and nothing for the default (Reset To Default)', () => {
    const tab = { id: 't-design', label: 'Design', fields: [] };
    expect(withTabGlyph(tab, 'code')).toEqual({ ...tab, glyph: 'code' });
    expect(withTabGlyph({ ...tab, glyph: 'code' }, undefined)).toEqual(tab);
    expect(withTabGlyph(tab, 'kanban')).toEqual(tab);
    expect(withDetailsGlyph(task, 'info').detailsGlyph).toBe('info');
    expect(withDetailsGlyph({ ...task, detailsGlyph: 'info' }, 'checklist')).not.toHaveProperty(
      'detailsGlyph',
    );
  });

  it('reads tab icons and the Details icon from a stored catalogue, older ones showing the defaults', () => {
    const [stored] = read([
      withTabs({
        detailsGlyph: 'info',
        tabs: [
          { id: OVERVIEW_TAB_ID, label: 'Overview', fields: [], glyph: 'book' },
          { id: 't-design', label: 'Design', fields: [], glyph: 'kanban' },
          { id: 't-risks', label: 'Risks', fields: [], glyph: 'not-a-glyph' as never },
        ],
      }),
    ]);
    expect(stored!.detailsGlyph).toBe('info');
    expect(stored!.tabs!.map((t) => t.glyph)).toEqual(['book', undefined, undefined]);
    // A plan from before tab icons: nothing stored, the defaults drawn, no migration.
    const [older] = read([withTabs()]);
    expect(older).not.toHaveProperty('detailsGlyph');
    expect(older!.tabs!.every((t) => !('glyph' in t))).toBe(true);
  });

  it('gives an inherited type its base type’s tab icons and Details icon', () => {
    const base = withTabs({
      id: 'work',
      label: 'Work',
      detailsGlyph: 'info',
      tabs: [{ id: 't-design', label: 'Design', fields: ['checklist'], glyph: 'code' }],
    });
    const bug = inheritFrom({ ...task, id: 'bug', label: 'Bug', glyph: 'bug' }, base);
    expect(bug.tabs?.[0]?.glyph).toBe('code');
    expect(bug.detailsGlyph).toBe('info');
    // A base's change reaches it.
    const [, after] = withInheritance([{ ...base, detailsGlyph: 'star' }, bug]);
    expect(after!.detailsGlyph).toBe('star');
  });
});

describe('settings from a newer version', () => {
  const later = {
    ...withTabs(),
    sparkle: { on: true },
    tabs: [{ id: OVERVIEW_TAB_ID, label: 'Overview', fields: [], colour: 'teal' }],
    custom: [{ id: 'f-size', label: 'Size', kind: 'number', unit: 'cm' }],
    fields: [...task.fields, 'f-size'],
  };

  it('keeps unknown type, tab and field keys through a read, so a save writes them back', () => {
    const [kept] = read([later]);
    expect(kept).toMatchObject({ sparkle: { on: true } });
    expect(kept!.tabs![0]).toMatchObject({ colour: 'teal' });
    expect(kept!.custom![0]).toMatchObject({ unit: 'cm' });
    // Read again (an older editor's save sends what it read): still there.
    const [again] = read([kept]);
    expect(again).toEqual(kept);
  });

  it('drops them on the api’s writes, the newest build', () => {
    const [written] = read([later], 'refuse');
    expect(written).not.toHaveProperty('sparkle');
    expect(written!.tabs![0]).not.toHaveProperty('colour');
    expect(written!.custom![0]).not.toHaveProperty('unit');
  });

  it('keeps an inherited type’s own unknown keys as it is resolved', () => {
    const base = withTabs({ id: 'work', label: 'Work' });
    const [, bug] = read([base, { ...task, id: 'bug', label: 'Bug', inherits: 'work', later: 1 }]);
    expect(bug).toMatchObject({ later: 1, inherits: 'work' });
  });

  it('drops unknown keys past their cap, or that cannot be copied, never refusing', () => {
    expect(newerKeysOf(null, ITEM_TYPE_KEYS)).toEqual({});
    expect(newerKeysOf({ id: 'x', gone: undefined }, ITEM_TYPE_KEYS)).toEqual({});
    expect(newerKeysOf({ big: 'x'.repeat(NEWER_KEYS_MAX_BYTES) }, ITEM_TYPE_KEYS)).toEqual({});
    expect(newerKeysOf({ n: 10n }, ITEM_TYPE_KEYS)).toEqual({});
    const [kept] = read([{ ...withTabs(), big: 'x'.repeat(NEWER_KEYS_MAX_BYTES) }]);
    expect(kept).not.toHaveProperty('big');
  });
});
