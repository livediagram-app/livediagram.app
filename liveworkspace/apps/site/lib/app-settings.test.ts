import { describe, expect, it } from 'vitest';
import type { CatalogueCategory, CatalogueRow } from '@liveworkspace/settings/catalogue';
import { appFromParam, isAppId, loadCatalogue, sectionRuns, visibleRows } from './app-settings';

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

describe('app settings', () => {
  it('reads a deep link by site id or name, and nothing else', () => {
    expect(appFromParam('livediagram')).toBe('livediagram.app');
    expect(appFromParam('LiveDesign')).toBe('livedesign.app');
    expect(appFromParam('liveplanner.app')).toBe('liveplanner.app');
    expect(appFromParam('liveworkspace')).toBeNull();
    expect(appFromParam('nope')).toBeNull();
    expect(appFromParam(null)).toBeNull();
    expect(isAppId('toString')).toBe(false);
  });

  it('shows a nested row only while its switch is on, and a power user’s only to them', () => {
    const when = { key: 'panel', on: true, off: false, fallback: true };
    const category: CatalogueCategory = {
      id: 'c',
      label: 'C',
      rows: [toggle('panel'), toggle('child', { when }), toggle('power', { powerUser: true })],
    };
    const ids = (all: object, app: object) =>
      visibleRows(category, { all: { ...all }, app: { ...app } }).map((r) => r.id);
    expect(ids({}, {})).toEqual(['panel', 'child']);
    expect(ids({}, { panel: false })).toEqual(['panel']);
    expect(ids({ powerUserMode: true }, {})).toEqual(['panel', 'child', 'power']);
    // A shared key only counts from the shared scope.
    expect(ids({}, { powerUserMode: true })).toEqual(['panel', 'child']);
  });

  it('groups consecutive rows by section, as the apps do', () => {
    const rows = [
      toggle('a', { section: 'One' }),
      toggle('b', { section: 'One' }),
      toggle('c', { section: 'Two' }),
      toggle('d'),
    ];
    expect(sectionRuns(rows).map((run) => [run.section, run.rows.map((r) => r.id)])).toEqual([
      ['One', ['a', 'b']],
      ['Two', ['c']],
      [undefined, ['d']],
    ]);
  });

  it("loads each app's catalogue", async () => {
    for (const app of [
      'livediagram.app',
      'liveplanner.app',
      'livedocuments.app',
      'livedesign.app',
    ]) {
      if (!isAppId(app)) throw new Error(app);
      expect((await loadCatalogue(app)).categories.length).toBeGreaterThan(0);
    }
  });
});
