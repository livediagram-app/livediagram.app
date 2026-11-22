import { describe, expect, it } from 'vitest';
import { AUTOMATION_QUEUE_MAX } from '../../limits';
import { itemAutomationSchemaSteps, itemAutomationTriggers } from './schema';
import { ANA, itemSql, queued, rowsOf, world } from './test-kit';
import { clearItemWriter, markItemWriter, withItemWriter } from './writer';

describe('the item step', () => {
  it('follows stage 1’s steps, and runs again harmlessly', () => {
    const steps = itemAutomationSchemaSteps({ links: 'document_tabs' });
    expect(steps.map((s) => s.name)).toEqual([
      'rules',
      'schedule',
      'hooks',
      'waiting',
      'ai_drafts',
      'fired',
      'addresses',
      'counts',
      'item',
    ]);
    const sql = itemSql();
    expect(() => sql.exec(String(steps.at(-1)!.run))).not.toThrow();
  });

  it('refuses a table name that is no identifier', () => {
    expect(() => itemAutomationTriggers({ links: 'tabs; DROP TABLE x' })).toThrow(
      'not a table name',
    );
    expect(
      itemAutomationTriggers({ tabs: 'pages', links: 'design_tabs', tabKey: 'page_id' }),
    ).toContain('AFTER INSERT ON design_tabs');
  });
});

describe('the SQL triggers', () => {
  it('write nothing for an item with no rule on', () => {
    const w = world();
    w.addTab('t1');
    w.editTab('t1');
    w.removeTab('t1');
    expect(queued(w.sql)).toEqual([]);
    expect(rowsOf(w.sql, 'SELECT * FROM automation_edits')).toEqual([]);
    expect(rowsOf(w.sql, 'SELECT * FROM automation_settles')).toEqual([]);
  });

  it('queue a tab added and a tab removed, with the tab’s name, only for the kind a rule hears', () => {
    const w = world();
    w.rule({ trigger: { kind: 'tab_removed' } });
    w.addTab('t1', 'Roadmap');
    expect(queued(w.sql)).toEqual([]);
    w.rule({ trigger: { kind: 'tab_added' } });
    w.addTab('t2', 'Retro');
    w.removeTab('t1');
    const events = queued(w.sql);
    expect(events.map((e) => [e.kind, e.tab, e.data])).toEqual([
      ['tab_added', 't2', { 'tab.name': 'Retro' }],
      ['tab_removed', 't1', { 'tab.name': 'Roadmap' }],
    ]);
    expect(events[0]!.id).toMatch(/^tab_added:t2:\d+:0$/);
    expect(typeof events[0]!.at).toBe('number');
    expect(events[0]!.by).toBeUndefined();
  });

  it('name whoever the writer’s window names, and close with it', async () => {
    const w = world();
    w.rule({ trigger: { kind: 'tab_added' } });
    await withItemWriter(w.sql, { who: { by: ANA, role: 'editor' } }, () => w.addTab('t1'));
    w.addTab('t2');
    const [first, second] = queued(w.sql);
    expect(first).toMatchObject({ by: ANA, role: 'editor', tab: 't1' });
    expect(second!.by).toBeUndefined();
    await expect(
      withItemWriter(w.sql, {}, () => Promise.reject(new Error('write failed'))),
    ).rejects.toThrow('write failed');
    expect(rowsOf(w.sql, 'SELECT * FROM automation_writer')).toEqual([]);
  });

  it('keep a step from another app’s chain on the windows its route opens inside', async () => {
    const w = world();
    w.rule({ trigger: { kind: 'tab_added' } });
    const cross = { id: 'c1', hops: 1, rules: ['liveplanner:p:r'] };
    await withItemWriter(w.sql, { who: { by: ANA, role: 'automation', cross }, own: true }, () =>
      withItemWriter(w.sql, { who: { by: ANA, role: 'editor' } }, async () => {
        w.addTab('t1');
        await withItemWriter(w.sql, { silent: true }, () => w.addTab('t2'));
      }),
    );
    await withItemWriter(w.sql, { who: { by: ANA, role: 'editor' } }, () => w.addTab('t3'));
    expect(queued(w.sql).map((e) => [e.tab, e.role, e.cross])).toEqual([
      ['t1', 'automation', cross],
      ['t3', 'editor', undefined],
    ]);
  });

  it('do nothing inside a silent window, and ignore a window a crash left open', () => {
    const w = world();
    w.rule({ trigger: { kind: 'tab_added' } });
    w.rule({ trigger: { kind: 'edited', minutes: 5 } });
    markItemWriter(w.sql, { silent: true });
    w.addTab('t1');
    w.editTab('t1');
    expect(queued(w.sql)).toEqual([]);
    expect(rowsOf(w.sql, 'SELECT * FROM automation_edits')).toEqual([]);
    // The same window, long past its end.
    markItemWriter(w.sql, { silent: true }, Date.now() - 10 * 60_000);
    w.addTab('t2');
    expect(queued(w.sql).map((e) => e.tab)).toEqual(['t2']);
    clearItemWriter(w.sql);
  });

  it('stamp edits and push back the settles, but never for a rule’s own write', () => {
    const w = world();
    w.addTab('t1');
    w.addTab('t2');
    const whole = w.rule({ trigger: { kind: 'edited', minutes: 5 } });
    const one = w.rule({ trigger: { kind: 'edited', minutes: 10, tab: 't2' } });
    const before = Date.now();
    w.editTab('t1');
    expect(rowsOf(w.sql, 'SELECT tab_id FROM automation_edits')).toEqual([{ tab_id: 't1' }]);
    let settles = rowsOf(w.sql, 'SELECT rule_id, key, due_at, data FROM automation_settles');
    expect(settles).toHaveLength(1);
    expect(settles[0]).toMatchObject({ rule_id: whole.id, key: '', data: '{"tab":"t1"}' });
    // SQLite's clock (a Julian day) may read a millisecond or two behind JavaScript's.
    expect(Number(settles[0]!['due_at'])).toBeGreaterThanOrEqual(before + 5 * 60_000 - 5);
    w.editTab('t2');
    settles = rowsOf(w.sql, 'SELECT rule_id, key, data FROM automation_settles ORDER BY rule_id');
    expect(settles).toEqual([
      { rule_id: whole.id, key: '', data: '{"tab":"t2"}' },
      { rule_id: one.id, key: 't2', data: '{"tab":"t2"}' },
    ]);
    w.sql.exec('DELETE FROM automation_settles');
    w.sql.exec('DELETE FROM automation_edits');
    markItemWriter(w.sql, { who: { role: 'automation', rule: 'r9', chain: 1 }, own: true });
    w.editTab('t1');
    expect(rowsOf(w.sql, 'SELECT * FROM automation_settles')).toEqual([]);
    expect(rowsOf(w.sql, 'SELECT * FROM automation_edits')).toEqual([]);
    clearItemWriter(w.sql);
  });

  it('fire under an upsert of the tab, as the apps save one, each time it lands', () => {
    const w = world();
    w.rule({ trigger: { kind: 'edited', minutes: 5 } });
    const save = () =>
      w.sql.exec(
        `INSERT INTO tabs (id, name, data) VALUES (?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET data = excluded.data, rev = rev + 1`,
        't1',
        'Roadmap',
        '{}',
      );
    save();
    expect(rowsOf(w.sql, 'SELECT * FROM automation_settles')).toEqual([]);
    save();
    save();
    expect(rowsOf(w.sql, 'SELECT key FROM automation_settles')).toEqual([{ key: '' }]);
    expect(rowsOf(w.sql, 'SELECT tab_id FROM automation_edits')).toEqual([{ tab_id: 't1' }]);
  });

  it('keep the item’s last edit when a tab goes, and count a tab added as an edit', () => {
    const w = world();
    w.rule({ trigger: { kind: 'not_edited', days: 3, at: '09:00' } });
    w.addTab('t1');
    w.addTab('t2');
    expect(rowsOf(w.sql, 'SELECT tab_id FROM automation_edits ORDER BY tab_id')).toEqual([
      { tab_id: 't1' },
      { tab_id: 't2' },
    ]);
    w.removeTab('t1');
    expect(rowsOf(w.sql, 'SELECT tab_id FROM automation_edits ORDER BY tab_id')).toEqual([
      { tab_id: '' },
      { tab_id: 't2' },
    ]);
  });

  it('stop queueing once the queue is full', () => {
    const w = world();
    w.rule({ trigger: { kind: 'tab_added' } });
    w.sql.exec(
      `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < ${AUTOMATION_QUEUE_MAX})
       INSERT INTO automation_queue (event, at) SELECT '{}', 0 FROM n`,
    );
    w.addTab('t1');
    expect(rowsOf(w.sql, 'SELECT COUNT(*) AS n FROM automation_queue')[0]!['n']).toBe(
      AUTOMATION_QUEUE_MAX,
    );
  });
});
