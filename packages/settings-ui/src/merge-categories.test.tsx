// @vitest-environment jsdom
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import type { AppCatalogue, CatalogueRow } from '@liveworkspace/settings/catalogue';
import { commonCatalogue } from '@liveworkspace/settings/common';
import { CATALOGUE as LIVEDESIGN } from '@liveworkspace/settings/catalogues/livedesign';
import { CATALOGUE as LIVEDIAGRAM } from '@liveworkspace/settings/catalogues/livediagram';
import { CATALOGUE as LIVEDOCUMENTS } from '@liveworkspace/settings/catalogues/livedocuments';
import { CATALOGUE as LIVEHUDDLE } from '@liveworkspace/settings/catalogues/livehuddle';
import { CATALOGUE as LIVEPLANNER } from '@liveworkspace/settings/catalogues/liveplanner';
import { APPS_GROUP, panelModel } from './CatalogueSettingsView';
import { groupCategories } from './groups';
import { mergeAppCategories, type MergeSource } from './merge-categories';
import type { SettingsCategory, SettingsRow } from './model';
import { SettingsCategoryPane } from './SettingsCategoryPane';
import { searchSettings } from './settings-search';
import { SETTINGS_APP_IDS, type SettingsAppId } from './store';
import { SettingsView } from './SettingsView';
import { renderWithKit } from './test/kit';

// The panel's one set of categories (liveworkspace/docs/specs/010-site/site.md "Settings", "One set of categories"): Common's
// and every app's merged by their place, each setting once and each section once, every row naming the apps it applies
// to, and This App's side the same kept to that app's rows.

const toggle = (key: string, label: string, extra: Partial<SettingsRow> = {}): SettingsRow =>
  ({
    kind: 'toggle',
    key,
    label,
    description: '',
    value: false,
    onChange: vi.fn(),
    ...extra,
  }) as SettingsRow;

// An app's own categories, every row marked as that app's, as panelModel marks them.
const app = (group: string, categories: SettingsCategory[]): MergeSource => ({
  group,
  categories: groupCategories(group, categories, { keepEmpty: true }).map((c) => ({
    ...c,
    rows: c.rows.map((r) => ({ ...r, apps: r.apps ?? [group] })),
  })),
});

// Common's, each row naming the apps that have it.
const common = (categories: SettingsCategory[]): MergeSource => ({
  group: 'common',
  shared: true,
  categories: groupCategories('common', categories, { keepEmpty: true }),
});

const both = ['a.app', 'b.app'];

describe('mergeAppCategories', () => {
  it('lists one category per place across Common and every app, nesting sub-categories the same way', () => {
    const merged = mergeAppCategories(
      [
        common([
          {
            id: 'editor',
            label: 'Editor',
            rows: [toggle('alignmentGuides', 'Alignment Guides', { apps: both })],
          },
          {
            id: 'pages',
            label: 'Pages',
            parent: 'editor',
            rows: [toggle('contents', 'Contents', { apps: both })],
          },
          {
            id: 'layers',
            label: 'Panels › Layers',
            rows: [toggle('layersOn', 'Layers', { apps: both })],
          },
          {
            id: 'map',
            label: 'Panels › Map',
            rows: [toggle('showMinimap', 'Map', { apps: both })],
          },
        ]),
        app('a.app', [
          { id: 'editor', label: 'Editor', rows: [] },
          { id: 'draw', label: 'Draw', parent: 'editor', rows: [toggle('pen', 'Pen')] },
          // Left empty once its common rows are Common's: it still says where Tours goes.
          { id: 'map', label: 'Panels › Map', rows: [] },
          { id: 'tours', label: 'Tours', rows: [toggle('tourA', 'Tour A')] },
        ]),
        app('b.app', [
          { id: 'editor', label: 'Editor', rows: [toggle('snap', 'Snap')] },
          { id: 'pages', label: 'Pages', parent: 'editor', rows: [toggle('margin', 'Margins')] },
          { id: 'tours', label: 'Tours', rows: [toggle('tourB', 'Tour B')] },
          { id: 'plans', label: 'Plans', rows: [toggle('sort', 'Sort')] },
        ]),
      ],
      APPS_GROUP,
    );
    expect(merged.map((c) => [c.label, c.parent ?? null])).toEqual([
      ['Editor', null],
      ['Draw', 'apps:editor'],
      ['Pages', 'apps:editor'],
      ['Layers', null],
      ['Map', null],
      ['Tours', null],
      // Only one app has it: still listed once, under its own name.
      ['Plans', null],
    ]);
    expect(new Set(merged.map((c) => c.group))).toEqual(new Set([APPS_GROUP]));
    const editor = merged[0]!;
    // Every row says which apps it applies to; none sits under an app's heading.
    expect(editor.rows.map((r) => [r.key, r.apps])).toEqual([
      ['common:alignmentGuides', both],
      ['b.app:snap', ['b.app']],
    ]);
    expect(Object.keys(editor)).not.toContain('appHeadings');
    const tours = merged.find((c) => c.label === 'Tours')!;
    expect(tours.rows.map((r) => r.apps)).toEqual([['a.app'], ['b.app']]);
  });

  it('shows a setting two apps keep under the same key and wording once, for both, and writes it to each', () => {
    const a = toggle('grid', 'Show Grid');
    const b = toggle('grid', 'Show Grid');
    const differs = toggle('join', 'Someone Joins My Canvas');
    const other = toggle('join', 'Someone Joins My Document');
    const [editor] = mergeAppCategories(
      [
        app('a.app', [{ id: 'editor', label: 'Editor', rows: [a, differs] }]),
        app('b.app', [{ id: 'editor', label: 'Editor', rows: [b, other] }]),
      ],
      APPS_GROUP,
    );
    expect(editor!.rows.map((r) => [r.key, r.apps])).toEqual([
      ['a.app:grid', both],
      ['a.app:join', ['a.app']],
      ['b.app:join', ['b.app']],
    ]);
    const shared = editor!.rows[0] as Extract<SettingsRow, { kind: 'toggle' }>;
    shared.onChange(true);
    expect(a.kind === 'toggle' && a.onChange).toHaveBeenCalledWith(true);
    expect(b.kind === 'toggle' && b.onChange).toHaveBeenCalledWith(true);
  });

  it('lists each section once, every app’s rows under it, with the first note and any closed section', () => {
    const [tours] = mergeAppCategories(
      [
        app('a.app', [
          {
            id: 'tours',
            label: 'Tours',
            sectionNotes: { 'Offer Again': { note: 'From the bottom bar.' } },
            collapsedSections: ['Show Me'],
            rows: [
              toggle('diagram', 'Diagram Tour', { section: 'Offer Again' }),
              toggle('showSankey', 'Sankey', { section: 'Show Me' }),
            ],
          },
        ]),
        app('b.app', [
          {
            id: 'tours',
            label: 'Tours',
            sectionNotes: { 'Offer Again': { note: 'Another note.' } },
            rows: [
              toggle('forms', 'Forms Tour', { section: 'Offer Again' }),
              toggle('showChart', 'Chart', { section: 'Show Me' }),
            ],
          },
        ]),
      ],
      APPS_GROUP,
    );
    expect(tours!.rows.map((r) => [r.section, r.label])).toEqual([
      ['Offer Again', 'Diagram Tour'],
      ['Offer Again', 'Forms Tour'],
      ['Show Me', 'Sankey'],
      ['Show Me', 'Chart'],
    ]);
    expect(tours!.sectionNotes?.['Offer Again']?.note).toBe('From the bottom bar.');
    expect(tours!.collapsedSections).toEqual(['Show Me']);
    renderWithKit(<SettingsCategoryPane category={tours!} isMobile={false} />);
    expect(screen.getAllByRole('heading', { name: 'Offer Again' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: /Show Me/ })).toHaveLength(1);
  });

  it('keeps one app’s rows for This App, the categories left with any, and a shared row for both', () => {
    const merged = mergeAppCategories(
      [
        common([
          {
            id: 'editor',
            label: 'Editor',
            rows: [
              toggle('guides', 'Guides', { apps: both }),
              toggle('bOnly', 'Only B', { apps: ['b.app'] }),
            ],
          },
        ]),
        app('a.app', [
          { id: 'panels', label: 'Panels', rows: [toggle('grid', 'Show Grid')] },
          { id: 'map', label: 'Map', parent: 'panels', rows: [toggle('size', 'Size')] },
        ]),
        app('b.app', [
          { id: 'panels', label: 'Panels', rows: [toggle('grid', 'Show Grid')] },
          { id: 'plans', label: 'Plans', rows: [toggle('sort', 'Sort')] },
        ]),
      ],
      APPS_GROUP,
      { only: 'a.app' },
    );
    expect(merged.map((c) => c.label)).toEqual(['Editor', 'Panels', 'Map']);
    expect(merged[0]!.rows.map((r) => r.key)).toEqual(['common:guides']);
    // The same setting in both apps is still one row for both, and still writes to each.
    expect(merged[1]!.rows.map((r) => [r.key, r.apps])).toEqual([['a.app:grid', both]]);
    // Plans is b's alone: gone from a's side, its ids with it.
    expect(merged.some((c) => c.aliases?.includes('b.app:plans'))).toBe(false);
    const onlyB = mergeAppCategories(
      [app('b.app', [{ id: 'panels', label: 'Panels', rows: [toggle('x', 'X')] }])],
      APPS_GROUP,
      { only: 'a.app' },
    );
    expect(onlyB).toEqual([]);
  });

  it('keeps every old id as an alias of the merged category', () => {
    const merged = mergeAppCategories(
      [
        common([{ id: 'editor', label: 'Editor', rows: [toggle('guides', 'Guides')] }]),
        app('a.app', [
          { id: 'editor', label: 'Editor', rows: [] },
          { id: 'draw', label: 'Draw', parent: 'editor', rows: [toggle('pen', 'Pen')] },
        ]),
        app('b.app', [
          { id: 'panels', label: 'Panels', rows: [] },
          { id: 'map', label: 'Map', parent: 'panels', rows: [toggle('size', 'Size')] },
        ]),
      ],
      APPS_GROUP,
    );
    const byLabel = (label: string) => merged.find((c) => c.label === label)!;
    expect(byLabel('Editor').aliases).toEqual(
      expect.arrayContaining(['common:editor', 'editor', 'a.app:editor']),
    );
    expect(byLabel('Draw').aliases).toEqual(expect.arrayContaining(['a.app:draw', 'draw']));
    // Panels was left empty, so Map stands at the top level, under the name of the group it came from.
    expect(byLabel('Panels').parent).toBeUndefined();
  });

  it('lands the old ids of a category folded into another on the one it was folded into', () => {
    // livediagram's Draw became a section of Editor: `draw`, `livediagram.app:draw` and the merged sub-category it
    // was (`apps:editor/draw`) all open Editor. An old merged place written as a path (`/editor/presenting`) lands
    // on the category that carries it.
    const merged = mergeAppCategories(
      [
        app('a.app', [
          {
            id: 'editor',
            label: 'Editor',
            aliases: ['draw'],
            rows: [{ ...toggle('pen', 'Pen'), section: 'Draw' }],
          },
          {
            id: 'presenting',
            label: 'Presenting',
            aliases: ['/editor/presenting'],
            rows: [toggle('loop', 'Loop')],
          },
        ]),
      ],
      APPS_GROUP,
    );
    const editor = merged.find((c) => c.label === 'Editor')!;
    expect(merged.some((c) => c.label === 'Draw')).toBe(false);
    expect(editor.aliases).toEqual(
      expect.arrayContaining(['draw', 'a.app:draw', `${APPS_GROUP}:editor/draw`]),
    );
    expect(merged.find((c) => c.label === 'Presenting')!.aliases).toContain(
      `${APPS_GROUP}:editor/presenting`,
    );
  });

  it('searches only what the filter keeps', () => {
    const sources = [
      common([
        {
          id: 'editor',
          label: 'Editor',
          rows: [toggle('guides', 'Alignment Guides', { apps: both })],
        },
      ]),
      app('a.app', [{ id: 'editor', label: 'Editor', rows: [toggle('pen', 'Pen Pressure')] }]),
      app('b.app', [{ id: 'editor', label: 'Editor', rows: [toggle('ink', 'Pen Ink')] }]),
    ];
    expect(searchSettings(mergeAppCategories(sources, APPS_GROUP), 'pen').totalMatches).toBe(2);
    const onlyA = mergeAppCategories(sources, APPS_GROUP, { only: 'a.app' });
    expect(searchSettings(onlyA, 'pen').totalMatches).toBe(1);
    expect(searchSettings(onlyA, 'alignment').totalMatches).toBe(1);
  });

  it('stays linear on a large catalogue', () => {
    const CATEGORIES = 400;
    const ROWS = 25;
    const source = (group: string) =>
      app(
        group,
        Array.from({ length: CATEGORIES }, (_, c) => ({
          id: `c${c}`,
          label: `Category ${c}`,
          ...(c % 4 ? { parent: `c${c - (c % 4)}` } : {}),
          rows: Array.from({ length: ROWS }, (_, r) =>
            // Half the rows are the same setting in every app, half each app's own, in five sections.
            toggle(r % 2 ? `${group}-r${c}-${r}` : `r${c}-${r}`, `Row ${c}.${r}`, {
              section: `Section ${r % 5}`,
            }),
          ),
        })),
      );
    const sources = ['a.app', 'b.app', 'c.app', 'd.app'].map(source);
    // Warm up, then time: 40,000 rows across 1,600 categories.
    mergeAppCategories(sources, APPS_GROUP);
    let merged: SettingsCategory[] = [];
    const took = cpuMsOf(() => {
      merged = mergeAppCategories(sources, APPS_GROUP);
    });
    expect(merged).toHaveLength(CATEGORIES);
    // Each category: 13 shared rows once, and 12 own rows for each of the 4 apps.
    expect(merged[0]!.rows).toHaveLength(13 + 12 * 4);
    expect(took).toBeLessThan(cpuBudgetMs(250));
    const onlyTook = cpuMsOf(() => {
      merged = mergeAppCategories(sources, APPS_GROUP, { only: 'a.app' });
    });
    expect(merged[0]!.rows).toHaveLength(13 + 12);
    expect(onlyTook).toBeLessThan(cpuBudgetMs(250));
    // Three merges of 40,000 rows and the sources' build: more than the default 5 s on a loaded machine.
  }, 30_000);
});

describe('All in the Settings panel', () => {
  // Two apps' catalogues with a Tours each, one holding the same switch: one row, written to both, counted as each.
  const tour = (on = true): CatalogueRow => ({
    kind: 'toggle',
    id: 'tourWelcome',
    key: 'tourWelcome',
    label: 'Welcome Tour',
    description: '',
    on,
    off: !on,
    fallback: true,
  });
  const catalogue = (rows: CatalogueRow[]): AppCatalogue => ({
    categories: [{ id: 'tours', label: 'Tours', tile: 'tours', rows }],
    shared: [],
  });
  const catalogues = {
    'livediagram.app': catalogue([tour()]),
    'liveplanner.app': catalogue([tour()]),
  };

  it('writes a shared row to every app it covers, each through its own change', () => {
    const saver = { changeApp: vi.fn(), changeShared: vi.fn() };
    const { categories } = panelModel({
      mode: 'all',
      current: null,
      catalogues,
      common: commonCatalogue([]),
      value: { all: {}, apps: {} },
      account: {},
      saver,
    });
    const tours = categories.filter((c) => c.label === 'Tours');
    expect(tours).toHaveLength(1);
    expect(tours[0]!.rows).toHaveLength(1);
    const row = tours[0]!.rows[0] as Extract<SettingsRow, { kind: 'toggle' }>;
    expect(row.apps).toEqual(['livediagram.app', 'liveplanner.app']);
    row.onChange(false);
    expect(saver.changeApp.mock.calls.map(([app]) => app)).toEqual([
      'livediagram.app',
      'liveplanner.app',
    ]);
  });

  it('opens a bare or old per-app category id on its merged category', () => {
    const { categories, groups } = panelModel({
      mode: 'all',
      current: null,
      catalogues,
      common: commonCatalogue([]),
      value: { all: {}, apps: {} },
      account: {},
      saver: { changeApp: vi.fn(), changeShared: vi.fn() },
    });
    for (const id of ['tours', 'liveplanner.app:tours', 'notifications']) {
      const { unmount } = renderWithKit(
        <SettingsView
          categories={categories}
          groups={groups}
          isMobile={false}
          onClose={() => {}}
          initialCategoryId={id}
        />,
      );
      const rail = screen.getByRole('navigation', { name: 'Settings categories' });
      const current = within(rail)
        .getAllByRole('button')
        .find((b) => b.getAttribute('aria-current') === 'page');
      expect(current?.textContent, id).toBe(id === 'notifications' ? 'Notifications' : 'Tours');
      unmount();
    }
  });

  it('draws the phone’s root list with the merged categories and pushes one with a back bar', () => {
    const { categories, groups } = panelModel({
      mode: 'all',
      current: null,
      catalogues,
      common: commonCatalogue([]),
      value: { all: {}, apps: {} },
      account: {},
      saver: { changeApp: vi.fn(), changeShared: vi.fn() },
    });
    renderWithKit(
      <SettingsView categories={categories} groups={groups} isMobile onClose={() => {}} />,
    );
    const apps = screen.getByRole('group', { name: 'Apps' });
    fireEvent.click(within(apps).getByRole('button', { name: /^Tours/ }));
    expect(screen.getByRole('switch', { name: 'Welcome Tour' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Settings/ }));
    expect(screen.getByRole('group', { name: 'Apps' })).toBeTruthy();
  });
});

describe('the five apps’ catalogues in one set of categories', () => {
  const catalogues = {
    'livediagram.app': LIVEDIAGRAM,
    'liveplanner.app': LIVEPLANNER,
    'livedocuments.app': LIVEDOCUMENTS,
    'livedesign.app': LIVEDESIGN,
    'livehuddle.app': LIVEHUDDLE,
  };
  const common = commonCatalogue(
    Object.entries(catalogues).map(([app, catalogue]) => ({ app, catalogue })),
  );
  const model = (mode: 'all' | 'app', current: SettingsAppId | null = null) =>
    panelModel({
      mode,
      withShared: true,
      current,
      catalogues,
      common,
      value: { all: {}, apps: {} },
      account: { renderTokens: () => null },
      saver: { changeApp: vi.fn(), changeShared: vi.fn() },
    });
  const rows = (categories: readonly SettingsCategory[]) => categories.flatMap((c) => c.rows);

  it('lists every category once, with no Common or per-app group, every row naming its apps', () => {
    const { categories, groups } = model('all');
    expect(groups?.map((g) => g.label)).toEqual(['Account', 'Apps', 'Developers']);
    // Account's first, in their order, then the apps' merged categories, then Developers'; every category under one
    // of the labels, each label's categories together.
    const account = categories.filter((c) => c.group === 'account').map((c) => c.label);
    expect(account).toEqual(['Notifications', 'Privacy', 'Accessibility']);
    expect(categories.filter((c) => c.group === 'developers').map((c) => c.label)).toEqual([
      'API Tokens',
    ]);
    const order = categories.map((c) => c.group);
    expect(order).toEqual([
      ...order.filter((g) => g === 'account'),
      ...order.filter((g) => g === APPS_GROUP),
      ...order.filter((g) => g === 'developers'),
    ]);
    // Every account category is top-level, with a tile of its own.
    for (const c of categories.filter((c) => c.group !== APPS_GROUP)) {
      expect(c.parent, c.id).toBeUndefined();
      expect(c.icon, c.id).toBeTruthy();
    }
    const labels = categories.map((c) => `${c.parent ?? ''}/${c.label}`);
    expect(new Set(labels).size).toBe(labels.length);
    // No sub-categories: each panel and each mode is a section, and the sections read in SECTION_ORDER whichever
    // source brought one first (Common brings Pages before livediagram's Draw).
    expect(categories.filter((c) => c.parent !== undefined).map((c) => c.label)).toEqual([]);
    const sections = (label: string) => [
      ...new Set(categories.find((c) => c.label === label)!.rows.map((r) => r.section ?? '')),
    ];
    expect(sections('Editor')).toEqual(['Canvas', 'Mouse', 'Draw', 'Pages', 'Logo Pages']);
    expect(sections('Panels')).toEqual(['Layers', 'Quick Style', 'Map', 'Collaborate']);
    // The Explorer holds Show Home Banner without a heading repeating its name.
    expect(sections('Explorer')).toEqual(['']);
    for (const row of rows(categories)) {
      expect(row.apps?.length, row.key).toBeGreaterThan(0);
    }
    // The Account section's rows are every app's.
    const notifications = categories.find((c) => c.id === 'account:notifications')!;
    expect(notifications.rows.some((r) => r.apps?.length === SETTINGS_APP_IDS.length)).toBe(true);
  });

  it('keeps This App to the rows that apply to it, the same rows All shows for it', () => {
    for (const app of SETTINGS_APP_IDS) {
      const all = rows(model('all', app).categories).filter((r) => r.apps?.includes(app));
      const mine = model('app', app);
      expect(
        rows(mine.categories).map((r) => r.key),
        app,
      ).toEqual(all.map((r) => r.key));
      expect(mine.categories.every((c) => c.rows.length > 0)).toBe(true);
      // A category every row of which belongs to another app is gone from the rail.
      const ids = new Set(mine.categories.map((c) => c.id));
      for (const c of mine.categories) if (c.parent) expect(ids.has(c.parent)).toBe(true);
    }
  });

  it('merges all five catalogues fast: the panel’s whole model, timed', () => {
    model('all');
    const took = cpuMsOf(() => {
      for (let i = 0; i < 20; i++) model('all');
    });
    const each = took / 20;
    // Printed for the spec's and the PR's measured number.
    console.info(`[perf] five-app Settings model: ${each.toFixed(2)} ms per build`);
    expect(each).toBeLessThan(cpuBudgetMs(20));
  });
});
