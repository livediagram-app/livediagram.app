import { describe, expect, it } from 'vitest';
import type { AppCatalogue, CatalogueRow } from './catalogue';
import { CATALOGUE as LIVEDESIGN } from './catalogues/livedesign';
import { CATALOGUE as LIVEDIAGRAM } from './catalogues/livediagram';
import { CATALOGUE as LIVEDOCUMENTS } from './catalogues/livedocuments';
import { CATALOGUE as LIVEPLANNER } from './catalogues/liveplanner';
import { commonCatalogue, isCommonRow, rowBindings, withoutCommonRows } from './common';
import { COMMON_SETTING_KEYS, isAllSetting } from './index';

const SOURCES = [
  { app: 'livediagram.app', catalogue: LIVEDIAGRAM },
  { app: 'liveplanner.app', catalogue: LIVEPLANNER },
  { app: 'livedocuments.app', catalogue: LIVEDOCUMENTS },
  { app: 'livedesign.app', catalogue: LIVEDESIGN },
];

const rowsOf = (catalogue: AppCatalogue) => catalogue.categories.flatMap((c) => c.rows);
const keysOf = (rows: readonly CatalogueRow[]) =>
  new Set(rows.flatMap((row) => rowBindings(row).map((b) => b.key)));

// What the row stores and how, without its wording or place: the same in every app that has it.
const meaning = (row: CatalogueRow) =>
  JSON.stringify(
    rowBindings(row).map(({ key, field, ...rest }) => {
      const r = rest as Record<string, unknown>;
      return {
        key,
        field,
        on: r.on,
        off: r.off,
        fallback: r.fallback,
        options: (r.options as { id: string; value: unknown }[] | undefined)?.map((o) => [
          o.id,
          o.value,
        ]),
        min: r.min,
        max: r.max,
        step: r.step,
      };
    }),
  );

describe('the common settings', () => {
  it('are exactly the shared editor settings two or more apps have', () => {
    const appsByKey = new Map<string, Set<string>>();
    for (const { app, catalogue } of SOURCES) {
      for (const key of keysOf(rowsOf(catalogue))) {
        if (!appsByKey.has(key)) appsByKey.set(key, new Set());
        appsByKey.get(key)!.add(app);
      }
    }
    const inSeveral = [...appsByKey].filter(([, apps]) => apps.size > 1).map(([key]) => key);
    // notifyDocumentJoin is livediagram's and livedocuments' own: each app's "someone joins my …" email.
    expect(inSeveral.filter((key) => key !== 'notifyDocumentJoin').sort()).toEqual(
      [...COMMON_SETTING_KEYS].sort(),
    );
    expect(isAllSetting('notifyDocumentJoin')).toBe(false);
  });

  it('mean the same in every app that has one', () => {
    const byId = new Map<string, Set<string>>();
    for (const { catalogue } of SOURCES) {
      for (const row of rowsOf(catalogue).filter(isCommonRow)) {
        if (!byId.has(row.id)) byId.set(row.id, new Set());
        byId.get(row.id)!.add(meaning(row));
      }
    }
    for (const [id, meanings] of byId) expect([id, meanings.size]).toEqual([id, 1]);
  });
});

describe('commonCatalogue', () => {
  const { catalogue, apps } = commonCatalogue(SOURCES);
  const rows = rowsOf(catalogue);

  it('holds every common setting once', () => {
    expect(keysOf(rows)).toEqual(new Set(COMMON_SETTING_KEYS));
    const ids = rows.map((row) => row.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(rows.every(isCommonRow)).toBe(true);
  });

  it('files them in the categories the apps use', () => {
    expect(catalogue.categories.map((c) => [c.id, c.label, c.parent ?? null])).toEqual([
      ['editor', 'Editor', null],
      ['pages', 'Pages', 'editor'],
      ['presenting', 'Presenting', 'editor'],
      ['layers', 'Panels › Layers', null],
      ['map', 'Panels › Map', null],
      ['collaborate', 'Panels › Collaborate', null],
      ['quickStyle', 'Panels › Quick Style', null],
      ['explorer', 'Explorer', null],
    ]);
    const map = catalogue.categories.find((c) => c.id === 'map')!;
    expect(map.rows.map((r) => [r.id, r.parent ?? null])).toEqual([
      ['showMinimap', null],
      ['mapDimOutside', 'showMinimap'],
      ['mapSize', 'showMinimap'],
    ]);
  });

  it("puts Show Home Banner under the platform's Explorer, not an app's Documents or Plans", () => {
    const explorer = catalogue.categories.find((c) => c.id === 'explorer')!;
    expect(explorer.tile).toBe('folder');
    expect(explorer.rows.map((r) => [r.id, r.label, r.section ?? null])).toEqual([
      ['homeBanner', 'Show Home Banner', null],
    ]);
    expect(apps.get('homeBanner')).toEqual([
      'livediagram.app',
      'liveplanner.app',
      'livedocuments.app',
      'livedesign.app',
    ]);
    expect(apps.get('contentsPlacement')).toEqual(['livedocuments.app', 'livedesign.app']);
  });

  it('names a sub-category by its path when its parent is not there', () => {
    const only = commonCatalogue([{ app: 'livedocuments.app', catalogue: editorOwnRowsOnly() }]);
    expect(only.catalogue.categories.some((c) => c.id === 'editor')).toBe(false);
    expect(only.catalogue.categories.find((c) => c.id === 'pages')?.label).toBe('Editor › Pages');
  });
});

describe('withoutCommonRows', () => {
  it("leaves each app's own rows, and every app keeps some", () => {
    for (const { catalogue } of SOURCES) {
      const own = rowsOf(withoutCommonRows(catalogue));
      expect(own.length).toBeGreaterThan(0);
      expect(own.some(isCommonRow)).toBe(false);
      expect(own.length + rowsOf(catalogue).filter(isCommonRow).length).toBe(
        rowsOf(catalogue).length,
      );
    }
  });
});

// livedocuments' catalogue with only its own rows left in Editor, so Common has no Editor category.
function editorOwnRowsOnly(): AppCatalogue {
  return {
    ...LIVEDOCUMENTS,
    categories: LIVEDOCUMENTS.categories.map((c) =>
      c.id === 'editor' ? { ...c, rows: c.rows.filter((row) => !isCommonRow(row)) } : c,
    ),
  };
}
