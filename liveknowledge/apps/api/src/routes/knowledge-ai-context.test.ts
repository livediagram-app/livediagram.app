import { afterEach, describe, expect, it, vi } from 'vitest';
import { nodeItemSql } from '@liveworkspace/index-app/testing';
import { MAX_PAGE_ANSWER_ROWS } from '@liveknowledge/knowledge';
import { pruneKnowledge } from '../knowledge/room-knowledge';
import { fakeClaude, knowledgeKit, type Kit, type Who } from './knowledge-test-kit';

// docs/specs/030-knowledgebase/ai-knowledge.md "AI Context on a page": the questions Ask answered from a page and
// the agents that read it, counted by the room and read with Page Health.
vi.mock('../index-service', async (original) => {
  const tests = await import('../test-sqlite-d1');
  return {
    ...(await original<typeof import('../index-service')>()),
    requestGrant: tests.testRequestGrant,
    indexFor: tests.testIndexFor,
  };
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const withSecret = { AI_KEY_SECRET: 'test-ai-key-secret' };
const KEY = 'sk-ant-test-0123456789abcdefghij-4f2a';
// Cites the first passage Ask sent: the Deploys page's, for a question about deploys.
const CITED = '<answer>Deploys go out on Tuesdays [1].</answer>';
const UNCITED = '<answer>The pages do not say.</answer><gap>When is lunch?</gap>';
const DAY = 86_400_000;

type Health = {
  answered?: { question: string; asked: number }[];
  agents?: { agent: string; reads: number }[];
};
const health = async (kit: Kit, who: Who = 'viewer', tab = 'deploys') =>
  await (await kit.call(who, 'GET', `/api/documents/kb/pages/${tab}/health`)).json<Health>();

async function keyedKit(reply: string): Promise<Kit> {
  vi.stubGlobal('fetch', fakeClaude(reply).fetch);
  const kit = await knowledgeKit(withSecret);
  await kit.call('editor', 'PUT', '/api/documents/kb/ai/key', { key: KEY });
  return kit;
}

const ask = async (kit: Kit, question: string, who: Who = 'viewer', turns?: unknown[]) => {
  const res = await kit.call(who, 'POST', '/api/documents/kb/ask', {
    question,
    ...(turns ? { turns } : {}),
  });
  expect(res.status).toBe(200);
  // The stream is read to its end, so the answer's bookkeeping has run.
  await res.text();
};

const rows = (kit: Kit) =>
  kit.db.sql.prepare('SELECT tab, key, question, asked FROM page_answers ORDER BY tab').all();

describe('Answered From This Page', () => {
  it('counts a first question for each page its answer cited; every reading role sees it', async () => {
    const kit = await keyedKit(CITED);
    await ask(kit, 'When do we deploy?');
    await ask(kit, 'when do we   deploy', 'participant');
    await ask(kit, 'How do deploys go out?', 'editor');
    expect(rows(kit)).toEqual([
      { tab: 'deploys', key: 'deploy', question: 'when do we deploy', asked: 2 },
      { tab: 'deploys', key: 'deploy go out', question: 'How do deploys go out?', asked: 1 },
    ]);
    for (const who of ['editor', 'participant', 'viewer', 'link', 'page-link'] as const) {
      const res = await kit.call(who, 'GET', '/api/documents/kb/pages/deploys/health');
      if (who === 'page-link') continue;
      expect(res.status).toBe(200);
      expect((await res.json<Health>()).answered).toEqual([
        { question: 'when do we deploy', asked: 2 },
        { question: 'How do deploys go out?', asked: 1 },
      ]);
    }
    // A page no answer cited has none.
    expect((await health(kit, 'viewer', 'holidays')).answered).toEqual([]);
    expect(
      (await kit.call('stranger', 'GET', '/api/documents/kb/pages/deploys/health')).status,
    ).toBe(403);
  });

  it('counts no follow-up and no answer that cited nothing', async () => {
    const kit = await keyedKit(CITED);
    await ask(kit, 'When do we deploy?', 'viewer', [
      { question: 'What do we ship?', answer: 'Deploys.' },
    ]);
    expect(rows(kit)).toEqual([]);
    vi.stubGlobal('fetch', fakeClaude(UNCITED).fetch);
    await ask(kit, 'When is lunch on deploy day?');
    expect(rows(kit)).toEqual([]);
    // The gap is still logged, as before.
    expect(kit.db.sql.prepare('SELECT question FROM questions').all()).toEqual([
      { question: 'When is lunch?' },
    ]);
  });

  it('is pruned past 30 days and to its cap by the daily upkeep, and goes with its page', async () => {
    const kit = await keyedKit(CITED);
    await ask(kit, 'When do we deploy?');
    const sql = nodeItemSql(kit.db.sql);
    pruneKnowledge(sql, Date.now() + 29 * DAY);
    expect(rows(kit)).toHaveLength(1);
    pruneKnowledge(sql, Date.now() + 31 * DAY);
    expect(rows(kit)).toEqual([]);

    const insert = kit.db.sql.prepare(
      "INSERT INTO page_answers (tab, key, day, question, asked) VALUES (?, ?, '2000-01-01', 'Old?', 1)",
    );
    for (let i = 0; i <= MAX_PAGE_ANSWER_ROWS; i++) insert.run(`t${i}`, 'old');
    await ask(kit, 'When do we deploy?');
    pruneKnowledge(sql, Date.now());
    expect(rows(kit)).toEqual([
      { tab: 'deploys', key: 'deploy', question: 'When do we deploy?', asked: 1 },
    ]);

    // A page in the Trash keeps its rows; deleted forever, it takes them with it.
    expect((await kit.call('editor', 'DELETE', '/api/documents/kb/tabs/deploys')).status).toBe(204);
    expect(rows(kit)).toHaveLength(1);
    expect((await kit.call('editor', 'DELETE', '/api/documents/kb/trash/deploys')).status).toBe(
      204,
    );
    expect(rows(kit)).toEqual([]);
  });
});

describe('Read by Agents', () => {
  it("names the agents that read the page this week, by their reads; a person's read is not one", async () => {
    const kit = await knowledgeKit();
    await kit.call('viewer', 'GET', '/api/documents/kb/tabs/deploys');
    await kit.call('agent', 'GET', '/api/documents/kb/tabs/deploys');
    await kit.call('agent', 'GET', '/api/documents/kb/tabs/deploys');
    const { agents } = await health(kit, 'viewer');
    expect(agents).toHaveLength(1);
    expect(agents![0]!.reads).toBe(2);
    expect(agents![0]!.agent).toEqual(expect.any(String));
    expect((await health(kit, 'viewer', 'holidays')).agents).toEqual([]);
  });
});
