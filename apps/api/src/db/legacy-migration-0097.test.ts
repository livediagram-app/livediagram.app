import { describe, expect, it } from 'vitest';
import { applyMigration, sqliteD1 } from '../test-sqlite-d1';

// Migration 0097 renames Draw mode's telemetry to Drawing (docs/specs/007-editor/editor-modes.md
// "Telemetry"), so the dashboard's lines continue. Seeded under the 0096 schema, then migrated.
describe('migration 0097: Drawing telemetry', () => {
  it('moves the Draw history to Drawing and touches nothing else', () => {
    const { sql } = sqliteD1({}, { before: '0097' });
    const insert = sql.prepare(
      'INSERT INTO events (category, action, type, ts) VALUES (?, ?, ?, 1)',
    );
    insert.run('Draw', 'Created', 'Template');
    insert.run('Editor', 'Changed', 'ModeDraw');
    insert.run('UI', 'Started', 'DrawTour');
    insert.run('UI', 'Opened', 'DrawTourOffer');
    insert.run('UI', 'Viewed', 'DrawTourStepDrawingTools');
    insert.run('UI', 'Toggled', 'DrawTourSeenOff');
    insert.run('Help', 'View', 'draw-mode');
    insert.run('Help', 'Helpful', 'draw-tour');
    insert.run('Folder', 'Cleared', 'DefaultModeDraw');
    insert.run('UI', 'Toggled', 'TemplateModeDraw');
    insert.run('UI', 'Used', 'JustDraw');

    applyMigration(sql, '0097');

    const rows = sql.prepare('SELECT category, action, type FROM events ORDER BY id').all();
    expect(rows.map((r) => ({ ...r }))).toEqual([
      { category: 'Drawing', action: 'Created', type: 'Template' },
      { category: 'Editor', action: 'Changed', type: 'ModeDrawing' },
      { category: 'UI', action: 'Started', type: 'DrawingTour' },
      { category: 'UI', action: 'Opened', type: 'DrawingTourOffer' },
      { category: 'UI', action: 'Viewed', type: 'DrawingTourStepDrawingTools' },
      { category: 'UI', action: 'Toggled', type: 'DrawingTourSeenOff' },
      { category: 'Help', action: 'View', type: 'drawing-mode' },
      { category: 'Help', action: 'Helpful', type: 'drawing-tour' },
      { category: 'Folder', action: 'Cleared', type: 'DefaultModeDraw' },
      { category: 'UI', action: 'Toggled', type: 'TemplateModeDraw' },
      { category: 'UI', action: 'Used', type: 'JustDraw' },
    ]);
  });
});
