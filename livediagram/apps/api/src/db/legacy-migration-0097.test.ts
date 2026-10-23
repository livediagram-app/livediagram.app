import { describe, expect, it } from 'vitest';
import { applyMigration, sqliteD1 } from '../test-sqlite-d1';

// Migration 0097: Illustrate mode is Pages mode (docs/specs/007-editor/editor-modes.md "Naming in the
// interface"). Seeded under the 0096 schema, then migrated.

const EVENTS: [string, string, string][] = [
  ['Editor', 'Changed', 'ModeIllustrate'],
  ['Tab', 'Changed', 'OpensInIllustrate'],
  ['UI', 'Started', 'IllustrateTour'],
  ['UI', 'View', 'IllustrateTourStepSlideDeck'],
  ['UI', 'Toggled', 'TemplateModeIllustrate'],
  ['Document', 'Exported', 'IllustrateGIFPages'],
  ['Help', 'View', 'illustrate'],
  ['Help', 'Helpful', 'illustrate-tour'],
  ['Page', 'View', '/help/canvas/illustrate/illustrate-tour/'],
  ['Page', 'View', '/help/canvas/illustrate/slide-pages/'],
  ['Error', 'Client', 'Uncaught.IllustratePagePanel.TypeError'],
  ['Help', 'View', 'pages'],
];

function migrated() {
  const db = sqliteD1({}, { before: '0097' });
  const run = (q: string, ...args: string[]) => db.sql.prepare(q).run(...args);
  for (const [category, action, type] of EVENTS)
    run(
      'INSERT INTO events (category, action, type, ts) VALUES (?, ?, ?, 1)',
      category,
      action,
      type,
    );
  applyMigration(db.sql, '0097');
  return db.sql;
}

describe('migration 0097 (Illustrate mode is Pages mode)', () => {

  it('carries the telemetry history over to the new names, leaving error types alone', () => {
    const sql = migrated();
    const types = (
      sql.prepare('SELECT type FROM events ORDER BY id').all() as { type: string }[]
    ).map((r) => r.type);
    expect(types).toEqual([
      'ModePages',
      'OpensInPages',
      'PagesTour',
      'PagesTourStepSlideDeck',
      'TemplateModePages',
      'PagesGIFPages',
      'pages-mode',
      'pages-tour',
      '/help/canvas/pages-mode/pages-tour/',
      '/help/canvas/pages-mode/slide-pages/',
      'Uncaught.IllustratePagePanel.TypeError',
      'pages',
    ]);
  });
});
