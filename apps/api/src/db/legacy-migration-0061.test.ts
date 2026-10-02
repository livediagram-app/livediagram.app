import { describe, expect, it } from 'vitest';
import { applyMigration, sqliteD1 } from '../test-sqlite-d1';

// Migration 0061 renames the Whiteboard telemetry category to Draw (docs/specs/007-editor/editor-modes.md
// "Telemetry"), so the dashboard's lines continue. Seeded under the 0060 schema, then migrated.
describe('migration 0061: Draw telemetry', () => {
  it('moves the Whiteboard history to Draw and touches nothing else', () => {
    const { sql } = sqliteD1({}, { before: '0061' });
    const insert = sql.prepare(
      'INSERT INTO events (category, action, type, ts) VALUES (?, ?, ?, 1)',
    );
    insert.run('Whiteboard', 'Created', 'Template');
    insert.run('Whiteboard', 'Selected', 'Main');
    insert.run('Template', 'Used', 'Whiteboard');
    insert.run('Editor', 'Changed', 'ModeDraw');

    applyMigration(sql, '0061');

    const rows = sql.prepare('SELECT category, action, type FROM events ORDER BY id').all();
    expect(rows.map((r) => ({ ...r }))).toEqual([
      { category: 'Draw', action: 'Created', type: 'Template' },
      { category: 'Draw', action: 'Selected', type: 'Main' },
      { category: 'Template', action: 'Used', type: 'Whiteboard' },
      { category: 'Editor', action: 'Changed', type: 'ModeDraw' },
    ]);
  });
});
