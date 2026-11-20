import { describe, expect, it } from 'vitest';
import { nodeItemSql } from '@liveworkspace/index-app/testing';
import { knowledgeKit } from '../routes/knowledge-test-kit';
import { emailMarksSchemaStep } from './email-marks';
import { settleWrite, withKnowledgeIndex } from './knowledge-index';
import { dueWork, knowledgeWorkDueAt } from './knowledge-work';

// What makes the room owe its review check (docs/specs/030-knowledgebase/verification.md "Reminders"): a page's
// verification changing, the knowledgebase's Review Period changing (knowledge-settings-routes.test.ts), and the schema step for a knowledgebase that already holds verified pages.
describe('the review check is owed', () => {
  const setKnowledge = (
    kit: Awaited<ReturnType<typeof knowledgeKit>>,
    tab: string,
    fields: object,
  ) =>
    kit.db.sql
      .prepare(
        `UPDATE tabs SET data = json_set(data, '$.knowledge', json(?)), rev = rev + 1 WHERE id = ?`,
      )
      .run(JSON.stringify(fields), tab);

  it('counts a page whose verification changed, and not one whose writing, owner or stored period did', async () => {
    const kit = await knowledgeKit();
    const sql = nodeItemSql(kit.db.sql);
    setKnowledge(kit, 'deploys', { verifiedAt: 5, verifiedBy: 'user_o', owner: 'user_o' });
    expect(settleWrite(sql).trust).toBe(1);
    setKnowledge(kit, 'deploys', { verifiedAt: 5, verifiedBy: 'user_o', owner: 'user_p' });
    expect(settleWrite(sql)).toMatchObject({ pages: 1, trust: 0 });
    // A period a page once stored is nothing to the index: the Review Period is the knowledgebase's.
    setKnowledge(kit, 'deploys', { verifiedAt: 5, verifiedBy: 'user_o', reviewEvery: 30 });
    expect(settleWrite(sql)).toMatchObject({ pages: 1, trust: 0 });
    setKnowledge(kit, 'deploys', { verifiedAt: 6, verifiedBy: 'user_o' });
    expect(settleWrite(sql).trust).toBe(1);
    kit.db.sql
      .prepare(`UPDATE tabs SET name = 'Deploying', rev = rev + 1 WHERE id = 'deploys'`)
      .run();
    expect(settleWrite(sql)).toMatchObject({ pages: 1, trust: 0 });
  });

  it('tells the room through onTrust, once a write', async () => {
    const kit = await knowledgeKit();
    const sql = nodeItemSql(kit.db.sql);
    let told = 0;
    const hooks = withKnowledgeIndex(
      sql,
      { transaction: (fn) => fn(), ensureSchema: () => {}, onWrite: () => {} },
      { onTrust: () => told++ },
    );
    hooks.transaction(() => {
      setKnowledge(kit, 'deploys', { verifiedAt: 5, verifiedBy: 'user_o' });
      setKnowledge(kit, 'holidays', { verifiedAt: 6, verifiedBy: 'user_o' });
    });
    expect(told).toBe(1);
    hooks.onWrite();
    expect(told).toBe(1);
  });

  it('is owed at once by the schema step where verified pages already stand, and not otherwise', async () => {
    const kit = await knowledgeKit();
    const sql = nodeItemSql(kit.db.sql);
    const step = () => emailMarksSchemaStep((query) => sql.exec(query));
    step();
    expect(knowledgeWorkDueAt(sql)).toBeNull();
    await kit.call('editor', 'POST', '/api/documents/kb/pages/deploys/verify');
    step();
    step();
    expect(dueWork(sql, 1, 10)).toEqual([
      { kind: 'review-email', key: 'daily', dueAt: 0, payload: '' },
    ]);
  });
});
