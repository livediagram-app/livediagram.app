import { describe, expect, it, vi } from 'vitest';
import type { CatalogueCategory, CatalogueRow } from '@liveworkspace/settings/catalogue';
import type { SettingsChoiceRow, SettingsSliderRow, SettingsToggleRow } from './model';
import { catalogueModel, shortLabel, visibleCatalogueRows } from './catalogue-model';
import { isSettingsAppId, loadAppCatalogue } from './store';

const toggle = (id: string, extra: Partial<CatalogueRow> = {}) =>
  ({
    kind: 'toggle',
    id,
    label: id,
    description: '',
    key: id,
    on: true,
    off: false,
    fallback: true,
    ...extra,
  }) as CatalogueRow;

describe('an app’s catalogue in the panel', () => {
  it('shows a nested row only while its switch is on, and a power user’s only to them', () => {
    const when = { key: 'panel', on: true, off: false, fallback: true };
    const category: CatalogueCategory = {
      id: 'c',
      label: 'C',
      rows: [toggle('panel'), toggle('child', { when }), toggle('power', { powerUser: true })],
    };
    const ids = (all: object, app: object) =>
      visibleCatalogueRows(category, { all: { ...all }, app: { ...app } }).map((r) => r.id);
    expect(ids({}, {})).toEqual(['panel', 'child']);
    expect(ids({}, { panel: false })).toEqual(['panel']);
    expect(ids({ powerUserMode: true }, {})).toEqual(['panel', 'child', 'power']);
    // A shared key only counts from the shared scope.
    expect(ids({}, { powerUserMode: true })).toEqual(['panel', 'child']);
  });

  it("draws the app's rows in the shared view's model, each change handing over what to store", () => {
    const when = { key: 'panel', on: true, off: false, fallback: true };
    const change = vi.fn();
    const [editor, draw] = catalogueModel(
      {
        shared: [],
        categories: [
          {
            id: 'editor',
            label: 'Editor',
            tile: 'editor',
            sectionNotes: { One: 'A note.' },
            rows: [
              toggle('panel', { section: 'One', keywords: 'pane' }),
              toggle('child', { section: 'One', parent: 'panel', when }),
            ],
          },
          {
            id: 'draw',
            label: 'Draw',
            parent: 'editor',
            rows: [
              {
                kind: 'choice',
                id: 'size',
                label: 'Size',
                description: '',
                key: 'size',
                options: [
                  { id: 'small', label: 'Small', value: 's' },
                  { id: 'large', label: 'Large', value: 'l' },
                ],
                fallback: 'small',
              },
              {
                kind: 'slider',
                id: 'zoom',
                label: 'Zoom',
                description: '',
                key: 'zoom',
                min: 0.5,
                max: 1,
                step: 0.25,
                labels: ['50%', '75%', '100%'],
                fallback: 1,
              },
            ],
          },
        ],
      },
      { all: {}, app: { panel: true, size: 'l' } },
      change,
    );
    expect(editor).toMatchObject({ id: 'editor', sectionNotes: { One: { note: 'A note.' } } });
    expect(editor!.icon).toBeTruthy();
    expect(draw).toMatchObject({ id: 'draw', label: 'Draw', parent: 'editor' });
    const [panel, child] = editor!.rows as SettingsToggleRow[];
    expect(panel).toMatchObject({ key: 'panel', value: true, keywords: 'pane', section: 'One' });
    expect(child).toMatchObject({ key: 'child', parent: 'panel' });
    panel!.onChange(false);
    expect(change).toHaveBeenLastCalledWith(expect.objectContaining({ key: 'panel' }), false);
    const [size, zoom] = draw!.rows as [SettingsChoiceRow, SettingsSliderRow];
    expect(size.value).toBe('large');
    size.onChange('small');
    expect(change).toHaveBeenLastCalledWith(expect.objectContaining({ key: 'size' }), 's');
    expect([zoom.value, zoom.format(0.75)]).toEqual([1, '75%']);
    zoom.onCommit(0.5);
    expect(change).toHaveBeenLastCalledWith(expect.objectContaining({ key: 'zoom' }), 0.5);
  });

  it('names a sub-category by its parent while its parent shows nothing', () => {
    const when = { key: 'panel', on: true, off: false, fallback: true };
    const [only] = catalogueModel(
      {
        shared: [],
        categories: [
          { id: 'editor', label: 'Editor', tile: 'editor', rows: [toggle('hidden', { when })] },
          { id: 'draw', label: 'Draw', parent: 'editor', rows: [toggle('pen')] },
        ],
      },
      { all: {}, app: { panel: false } },
      vi.fn(),
    );
    // Its group's name, the only one shown from it ("Panels › Collaborate" was cut off in the rail).
    expect(only).toMatchObject({ id: 'draw', label: 'Editor' });
    expect(only).not.toHaveProperty('parent');
    // With its parent's tile.
    expect(only!.icon).toBeTruthy();
  });

  it('names a path short: its own name beside a sibling, and always under Account', () => {
    const groups = new Map([
      ['Panels', 2],
      ['Account', 1],
      ['Editor', 1],
    ]);
    expect(shortLabel('Panels › Map', groups)).toBe('Map');
    expect(shortLabel('Account › Notifications', groups)).toBe('Notifications');
    expect(shortLabel('Editor › Draw', groups)).toBe('Editor');
    expect(shortLabel('Tours', groups)).toBe('Tours');
  });

  it("loads each app's catalogue", async () => {
    for (const app of [
      'livediagram.app',
      'liveplanner.app',
      'livedocuments.app',
      'livedesign.app',
    ]) {
      if (!isSettingsAppId(app)) throw new Error(app);
      expect((await loadAppCatalogue(app)).categories.length).toBeGreaterThan(0);
    }
  });
});
