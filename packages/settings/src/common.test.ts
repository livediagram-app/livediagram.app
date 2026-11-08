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
    // The Layers panel's settings are livediagram's alone since livedocuments and livedesign retired the panel
    // (8 November 2026, liveworkspace/docs/specs/003-accounts/accounts.md "Common settings"). They stay common, so
    // a value a person set keeps living in `all` rather than moving scope.
    const layersPanelKeys = [
      'layersPanelEnabled',
      'layersShowPreview',
      'layersShowCount',
      'layerHoverPreview',
    ];
    for (const key of layersPanelKeys) {
      expect([key, [...appsByKey.get(key)!]]).toEqual([key, ['livediagram.app']]);
    }
    // notifyDocumentJoin is livediagram's and livedocuments' own: each app's "someone joins my …" email.
    const shared = inSeveral.filter((key) => key !== 'notifyDocumentJoin');
    expect([...shared, ...layersPanelKeys].sort()).toEqual([...COMMON_SETTING_KEYS].sort());
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
      ['presenting', 'Presenting', null],
      ['panels', 'Panels', null],
      ['explorer', 'Explorer', null],
    ]);
    // Presenting stands on its own tile; Pages' Contents is a section of Editor.
    expect(catalogue.categories.find((c) => c.id === 'presenting')?.tile).toBe('presenting');
    const editor = catalogue.categories.find((c) => c.id === 'editor')!;
    expect(editor.rows.find((r) => r.id === 'contentsPlacement')?.section).toBe('Pages');
    // The ids folded into them answer to Common's too (`common:pages`, `apps:editor/presenting`).
    expect(editor.aliases).toEqual(expect.arrayContaining(['draw', 'pages']));
    expect(catalogue.categories.find((c) => c.id === 'presenting')?.aliases).toEqual([
      '/editor/presenting',
    ]);
    // Each panel's settings are a section of Panels, in SECTION_ORDER's order, each switch before its own.
    const panels = catalogue.categories.find((c) => c.id === 'panels')!;
    expect(panels.aliases).toEqual(
      expect.arrayContaining(['layers', 'quickStyle', 'map', 'collaborate']),
    );
    expect(panels.rows.map((r) => [r.id, r.section ?? null, r.parent ?? null])).toEqual([
      ['layersPanelEnabled', 'Layers', null],
      ['layersShowPreview', 'Layers', 'layersPanelEnabled'],
      ['layersShowCount', 'Layers', 'layersPanelEnabled'],
      ['layerHoverPreview', 'Layers', 'layersPanelEnabled'],
      ['quickStylePanelEnabled', 'Quick Style', null],
      ['showMinimap', 'Map', null],
      ['mapDimOutside', 'Map', 'showMinimap'],
      ['mapSize', 'Map', 'showMinimap'],
      ['collaboratePanelEnabled', 'Collaborate', null],
    ]);
  });

  it("puts Automatically Open Explorer, then Show Home Banner, under the platform's Explorer, not an app's Documents or Plans", () => {
    const explorer = catalogue.categories.find((c) => c.id === 'explorer')!;
    expect(explorer.tile).toBe('folder');
    expect(explorer.rows.map((r) => [r.id, r.label, r.section ?? null])).toEqual([
      ['autoOpenExplorer', 'Automatically Open Explorer', null],
      ['homeBanner', 'Show Home Banner', null],
    ]);
    for (const id of ['autoOpenExplorer', 'homeBanner']) {
      expect(apps.get(id)).toEqual([
        'livediagram.app',
        'liveplanner.app',
        'livedocuments.app',
        'livedesign.app',
      ]);
    }
    expect(apps.get('contentsPlacement')).toEqual(['livedocuments.app', 'livedesign.app']);
  });

  it('names a sub-category by its path when its parent is not there', () => {
    const only = commonCatalogue([{ app: 'livedocuments.app', catalogue: contentsUnderEditor() }]);
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

// livedocuments' Editor with only its own rows left, so Common has no Editor category, and its Contents row in a
// Pages sub-category beneath it, as it once was.
function contentsUnderEditor(): AppCatalogue {
  const editor = LIVEDOCUMENTS.categories.find((c) => c.id === 'editor')!;
  return {
    ...LIVEDOCUMENTS,
    categories: [
      { ...editor, rows: editor.rows.filter((row) => !isCommonRow(row)) },
      {
        id: 'pages',
        label: 'Pages',
        parent: 'editor',
        rows: editor.rows.filter((row) => row.id === 'contentsPlacement'),
      },
    ],
  };
}
