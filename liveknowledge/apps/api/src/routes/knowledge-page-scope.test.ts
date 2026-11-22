import { describe, expect, it } from 'vitest';
import { knowledgeKit } from './knowledge-test-kit';

// A link confined to one page sees no other page through that page's own routes
// (docs/specs/013-workspace/tab-scoped-share-links.md, docs/specs/030-knowledgebase/links-and-embeds.md "Share roles"):
// Rollbacks sits under Deploys, which links to it, and the link is to Rollbacks alone.

type Ref = { tab: string; title: string };

describe('a link confined to one page', () => {
  it('reads no backlink, parent or conflict from a page it cannot see', async () => {
    const kit = await knowledgeKit();
    kit.db.sql.exec(
      `INSERT INTO conflicts (id, question, a_passage, a_tab, a_hash, b_passage, b_tab, b_hash, found_at, state)
         VALUES ('c1', 'How do we roll back?', 'p1', 'deploys', 'h1', 'p2', 'rollbacks', 'h2', 1, 'open')`,
    );
    // The whole knowledgebase's readers see them all.
    const whole = await (
      await kit.call('editor', 'GET', '/api/documents/kb/pages/rollbacks/backlinks')
    ).json<{ backlinks: Ref[] }>();
    expect(whole.backlinks).toEqual([{ tab: 'deploys', title: 'Deploys' }]);

    const linked = await kit.call(
      'page-edit-link',
      'GET',
      '/api/documents/kb/pages/rollbacks/backlinks',
    );
    expect(linked.status).toBe(200);
    expect(await linked.json()).toEqual({ backlinks: [] });

    const read = await kit.call('page-edit-link', 'GET', '/api/documents/kb/pages/rollbacks');
    expect(read.status).toBe(200);
    const { page } = await read.json<{
      page: { backlinks: Ref[]; parent?: string; trust: { conflictsWith?: Ref[] } };
    }>();
    expect(page.backlinks).toEqual([]);
    expect(page.parent).toBeUndefined();
    expect(page.trust.conflictsWith).toBeUndefined();
    expect(JSON.stringify(page)).not.toContain('Deploys');
  });

  it('never moves its page in the tree', async () => {
    const kit = await knowledgeKit();
    const moved = await kit.call(
      'page-edit-link',
      'POST',
      '/api/documents/kb/pages/rollbacks/move',
      {
        parent: null,
      },
    );
    expect(moved.status).toBe(403);
    const after = await (
      await kit.call('editor', 'GET', '/api/documents/kb/pages')
    ).json<{
      pages: { tab: string; parent?: string }[];
    }>();
    expect(after.pages.find((p) => p.tab === 'rollbacks')?.parent).toBe('deploys');
  });

  it('is not shown the questions Ask answered from its page', async () => {
    const kit = await knowledgeKit();
    const today = new Date().toISOString().slice(0, 10);
    kit.db.sql
      .prepare(
        "INSERT INTO page_answers (tab, key, day, question, asked) VALUES ('rollbacks', 'roll back', ?, 'How do we roll back the payroll run?', 2)",
      )
      .run(today);
    const health = async (who: 'editor' | 'page-edit-link') =>
      await (
        await kit.call(who, 'GET', '/api/documents/kb/pages/rollbacks/health')
      ).json<{ answered: unknown[] }>();
    expect((await health('editor')).answered).toHaveLength(1);
    expect((await health('page-edit-link')).answered).toEqual([]);
  });
});
