import { describe, expect, it } from 'vitest';
import { applyMigration, sqliteD1 } from '../test-sqlite-d1';

// Migration 0098: Facilitate mode is Workshop mode (docs/specs/007-editor/editor-modes.md "Naming in
// the interface"). Seeded under the 0097 schema, then migrated.

const EVENTS: [string, string, string][] = [
  ['Editor', 'Changed', 'ModeFacilitate'],
  ['UI', 'Toggled', 'TemplateModeFacilitate'],
  ['Folder', 'Changed', 'DefaultModeFacilitate'],
  ['UI', 'Started', 'FacilitateTour'],
  ['UI', 'View', 'FacilitateTourStepSessionStrip'],
  ['UI', 'Toggled', 'FacilitateTourSeenOff'],
  ['UI', 'Selected', 'Facilitator'],
  ['UI', 'Selected', 'FacilitatedNote'],
  ['Help', 'View', 'facilitate-mode'],
  ['Help', 'Helpful', 'facilitate-tour'],
  ['Help', 'View', 'facilitator'],
  ['Page', 'View', '/help/canvas/facilitate-mode/facilitate-tour/'],
  ['Page', 'View', '/help/canvas/facilitate-mode/'],
  ['Page', 'View', '/help/collaboration/facilitator/'],
  ['Error', 'Client', 'Uncaught.FacilitateTourHost.TypeError'],
];

function migrated() {
  const db = sqliteD1({}, { before: '0098' });
  const run = (q: string, ...args: string[]) => db.sql.prepare(q).run(...args);
  for (const [category, action, type] of EVENTS)
    run(
      'INSERT INTO events (category, action, type, ts) VALUES (?, ?, ?, 1)',
      category,
      action,
      type,
    );
  applyMigration(db.sql, '0098');
  return db.sql;
}

describe('migration 0098 (Facilitate mode is Workshop mode)', () => {

  it("carries the telemetry history over to the new names, leaving the facilitator's and errors alone", () => {
    const sql = migrated();
    const types = (
      sql.prepare('SELECT type FROM events ORDER BY id').all() as { type: string }[]
    ).map((r) => r.type);
    expect(types).toEqual([
      'ModeWorkshop',
      'TemplateModeWorkshop',
      'DefaultModeWorkshop',
      'WorkshopTour',
      'WorkshopTourStepSessionStrip',
      'WorkshopTourSeenOff',
      'Facilitator',
      'FacilitatedNote',
      'workshop-mode',
      'workshop-tour',
      'facilitator',
      '/help/canvas/workshop-mode/workshop-tour/',
      '/help/canvas/workshop-mode/',
      '/help/collaboration/facilitator/',
      'Uncaught.FacilitateTourHost.TypeError',
    ]);
  });
});
