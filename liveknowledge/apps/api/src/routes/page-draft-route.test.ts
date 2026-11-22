import { describe, expect, it } from 'vitest';
import { sqliteD1, testShareLink, type SqliteD1 } from '../test-sqlite-d1';
import { handleDocuments } from './documents';
import { makeTestRouteContext } from './test-route-context';

// docs/specs/030-knowledgebase/editing.md "What reads the saved page only", "Share roles": the tab GET hands a page's
// draft to an Editor's editor alone. A Viewer and a link visitor, a Participant, an agent's token and a document view
// read the saved page. Real SQLite (test-sqlite-d1.ts).

const OWNER = 'user_owner';
type Who = { owner?: string; headers?: Record<string, string>; token?: boolean };

function call(db: SqliteD1, path: string, who: Who = {}, method = 'GET', body?: unknown) {
  const owner = who.owner ?? OWNER;
  return handleDocuments(
    makeTestRouteContext(method, path, {
      env: db.env,
      owner,
      accountUserId: owner,
      verifiedUserId: owner,
      body,
      headers: who.headers,
      ...(who.token ? { token: { id: 'tok' } } : {}),
      waitUntil: () => {},
    }),
  );
}

const writing = (text: string) => ({ blocks: [{ id: 'a', type: 'paragraph', runs: [{ text }] }] });

async function pageWithDraft() {
  const db = sqliteD1();
  const created = await call(db, '/api/documents', {}, 'POST', {
    id: 'D',
    name: 'Handbook',
    tabs: [{ id: 't1', name: 'Onboarding', elements: [], articles: { 'art-1': writing('Saved') } }],
  });
  expect(created.status).toBe(201);
  const row = db.sql.prepare("SELECT data FROM tabs WHERE id = 't1'").get() as { data: string };
  const data = JSON.parse(row.data) as Record<string, unknown>;
  data.articles = { ...(data.articles as object), draft: writing('Draft') };
  data.draft = { by: 'Priya', at: 1, base: {} };
  db.sql
    .prepare("UPDATE tabs SET data = ?, rev = rev + 1 WHERE id = 't1'")
    .run(JSON.stringify(data));
  return db;
}

async function read(db: SqliteD1, who: Who, query = '') {
  const res = await call(db, `/api/documents/D/tabs/t1${query}`, who);
  return { status: res.status, text: await res.text() };
}

describe('the draft on the tab GET', () => {
  it("reaches an Editor's editor", async () => {
    const db = await pageWithDraft();
    const { status, text } = await read(db, {});
    expect(status).toBe(200);
    const { tab } = JSON.parse(text) as {
      tab: { articles: Record<string, unknown>; draft?: unknown };
    };
    expect(Object.keys(tab.articles).sort()).toEqual(['art-1', 'draft']);
    expect(tab.draft).toBeDefined();
  });

  it("reaches a Participant's link, who edits the page as an Editor does", async () => {
    const db = await pageWithDraft();
    testShareLink(db, 'D', 'PART', 'participate');
    const { status, text } = await read(db, {
      owner: 'guest_PART',
      headers: { 'X-Share-Code': 'PART' },
    });
    expect(status).toBe(200);
    expect(text).toContain('Priya');
  });

  it('never reaches a Viewer or a view link visitor', async () => {
    const db = await pageWithDraft();
    testShareLink(db, 'D', 'VIEW', 'view');
    for (const code of ['VIEW']) {
      const { status, text } = await read(db, {
        owner: `guest_${code}`,
        headers: { 'X-Share-Code': code },
      });
      expect(status).toBe(200);
      expect(text).not.toContain('Draft');
      expect(text).not.toContain('Priya');
      expect(text).toContain('Saved');
    }
  });

  it("never reaches an agent's token, nor a document view", async () => {
    const db = await pageWithDraft();
    const agent = await read(db, { token: true });
    expect(agent.status).toBe(200);
    expect(agent.text).not.toContain('Draft');
    const view = await read(db, {}, '?view=outline');
    expect(view.status).toBe(200);
    expect(view.text).not.toContain('Draft');
  });
});
