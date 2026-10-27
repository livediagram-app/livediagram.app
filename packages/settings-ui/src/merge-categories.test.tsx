// @vitest-environment jsdom
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import type { AppCatalogue, CatalogueRow } from '@liveworkspace/settings/catalogue';
import { commonCatalogue } from '@liveworkspace/settings/common';
import { APPS_GROUP, panelModel } from './CatalogueSettingsView';
import { groupCategories } from './groups';
import { mergeAppCategories, type MergeSource } from './merge-categories';
import type { SettingsCategory, SettingsRow } from './model';
import { searchSettings } from './settings-search';
import { SettingsView } from './SettingsView';
import { renderWithKit } from './test/kit';

// All's one set of categories (liveworkspace/docs/specs/010-site/site.md "Settings", "All"): Common's and every app's merged by
// their place, a setting the apps share shown once and written to each, each app's own rows under its logo and name.

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

const app = (group: string, label: string, categories: SettingsCategory[]): MergeSource => ({
  group,
  heading: { label, icon: <svg data-logo={group} /> },
  categories: groupCategories(group, categories, { keepEmpty: true }),
});

const common = (categories: SettingsCategory[]): MergeSource => ({
  group: 'common',
  categories: groupCategories('common', categories, { keepEmpty: true }),
});

describe('mergeAppCategories', () => {
  it('lists one category per place across Common and every app, nesting sub-categories the same way', () => {
    const merged = mergeAppCategories(
      [
        common([
          { id: 'editor', label: 'Editor', rows: [toggle('alignmentGuides', 'Alignment Guides')] },
          { id: 'pages', label: 'Pages', parent: 'editor', rows: [toggle('contents', 'Contents')] },
          { id: 'layers', label: 'Panels › Layers', rows: [toggle('layersOn', 'Layers')] },
          { id: 'map', label: 'Panels › Map', rows: [toggle('showMinimap', 'Map')] },
        ]),
        app('a.app', 'livea', [
          { id: 'editor', label: 'Editor', rows: [] },
          { id: 'draw', label: 'Draw', parent: 'editor', rows: [toggle('pen', 'Pen')] },
          // Left empty once its common rows are under Common: it still says where Tours goes.
          { id: 'map', label: 'Panels › Map', rows: [] },
          { id: 'tours', label: 'Tours', rows: [toggle('tourA', 'Tour A')] },
        ]),
        app('b.app', 'liveb', [
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
    // The shared row first, then each app's own under its heading.
    expect(editor.rows.map((r) => [r.key, r.app ?? null])).toEqual([
      ['common:alignmentGuides', null],
      ['b.app:snap', 'b.app'],
    ]);
    expect(editor.appHeadings?.['b.app']?.label).toBe('liveb');
    // An app with no rows of its own here has no heading here.
    expect(editor.appHeadings?.['a.app']).toBeUndefined();
    const tours = merged.find((c) => c.label === 'Tours')!;
    expect(tours.rows.map((r) => r.app)).toEqual(['a.app', 'b.app']);
  });

  it('shows a setting two apps keep under the same key and wording once, and writes it to each', () => {
    const a = toggle('grid', 'Show Grid');
    const b = toggle('grid', 'Show Grid');
    const differs = toggle('join', 'Someone Joins My Canvas');
    const other = toggle('join', 'Someone Joins My Document');
    const [editor] = mergeAppCategories(
      [
        app('a.app', 'livea', [{ id: 'editor', label: 'Editor', rows: [a, differs] }]),
        app('b.app', 'liveb', [{ id: 'editor', label: 'Editor', rows: [b, other] }]),
      ],
      APPS_GROUP,
    );
    expect(editor!.rows.map((r) => [r.key, r.app ?? null])).toEqual([
      ['a.app:grid', null],
      ['a.app:join', 'a.app'],
      ['b.app:join', 'b.app'],
    ]);
    const shared = editor!.rows[0] as Extract<SettingsRow, { kind: 'toggle' }>;
    shared.onChange(true);
    expect(a.kind === 'toggle' && a.onChange).toHaveBeenCalledWith(true);
    expect(b.kind === 'toggle' && b.onChange).toHaveBeenCalledWith(true);
  });

  it('keeps every old id as an alias, and points links and readouts at the merged category', () => {
    const merged = mergeAppCategories(
      [
        common([{ id: 'editor', label: 'Editor', rows: [toggle('guides', 'Guides')] }]),
        app('a.app', 'livea', [
          { id: 'editor', label: 'Editor', rows: [] },
          { id: 'draw', label: 'Draw', parent: 'editor', rows: [toggle('pen', 'Pen')] },
          {
            id: 'more',
            label: 'More',
            rows: [
              {
                kind: 'link',
                key: 'go',
                label: 'Go',
                description: '',
                target: 'draw',
                cta: 'Open',
              },
            ],
          },
        ]),
        app('b.app', 'liveb', [
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
    expect(byLabel('More').rows[0]).toMatchObject({ target: byLabel('Draw').id });
    // Panels was left empty, so Map stands at the top level, under the name of the group it came from.
    expect(byLabel('Panels').parent).toBeUndefined();
  });

  it('finds an app’s own rows by the app’s name, and a shared row by its own words', () => {
    const merged = mergeAppCategories(
      [
        common([{ id: 'editor', label: 'Editor', rows: [toggle('guides', 'Alignment Guides')] }]),
        app('a.app', 'livediagram', [
          { id: 'editor', label: 'Editor', rows: [toggle('pen', 'Pen Pressure')] },
        ]),
      ],
      APPS_GROUP,
    );
    expect(searchSettings(merged, 'livediagram').totalMatches).toBe(1);
    expect(searchSettings(merged, 'alignment').totalMatches).toBe(1);
  });

  it('stays linear on a large catalogue', () => {
    const CATEGORIES = 400;
    const ROWS = 25;
    const source = (group: string) =>
      app(
        group,
        group,
        Array.from({ length: CATEGORIES }, (_, c) => ({
          id: `c${c}`,
          label: `Category ${c}`,
          ...(c % 4 ? { parent: `c${c - (c % 4)}` } : {}),
          rows: Array.from({ length: ROWS }, (_, r) =>
            // Half the rows are the same setting in every app, half each app's own.
            toggle(r % 2 ? `${group}-r${c}-${r}` : `r${c}-${r}`, `Row ${c}.${r}`),
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
    // Each category: 13 shared rows once, then 12 own rows for each of the 4 apps.
    expect(merged[0]!.rows).toHaveLength(13 + 12 * 4);
    expect(took).toBeLessThan(cpuBudgetMs(250));
  });
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
      renderLogo: () => null,
      saver,
    });
    const tours = categories.filter((c) => c.label === 'Tours');
    expect(tours).toHaveLength(1);
    expect(tours[0]!.rows).toHaveLength(1);
    const row = tours[0]!.rows[0] as Extract<SettingsRow, { kind: 'toggle' }>;
    expect(row.app).toBeUndefined();
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
      renderLogo: () => null,
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
      renderLogo: () => null,
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
