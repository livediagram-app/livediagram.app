// Nothing private reaches the public site (docs/specs/030-knowledgebase/publishing.md "What is never published";
// blueprint P10 to P14). A knowledgebase holds a secret in every place a private thing lives; every public answer,
// and every field of the room's answer, is read for each of them.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { documentRoom } from '../document-client';
import { knowledgeKit, OWNER, page } from '../routes/knowledge-test-kit';
import { handlePublicSite } from './public-site';

vi.mock('../index-service', async (original) => {
  const tests = await import('../test-sqlite-d1');
  return {
    ...(await original<typeof import('../index-service')>()),
    requestGrant: tests.testRequestGrant,
    indexFor: tests.testIndexFor,
  };
});
vi.mock('../person/profiles', async (original) => ({
  ...(await original<typeof import('../person/profiles')>()),
  getParticipants: async (_env: unknown, ids: readonly string[]) =>
    new Map(
      ids.map((id) => [
        id,
        { ownerId: id, name: 'Olive Owner', email: 'SECRET-EMAIL@example.com' },
      ]),
    ),
}));

afterEach(() => vi.restoreAllMocks());

const para = (id: string, text: string, extra: object = {}) => ({
  id,
  type: 'paragraph',
  runs: [{ text }],
  ...extra,
});

// Every private thing, named so a leak is found by a search of the answer.
const SECRETS = [
  'SECRET-DRAFT',
  'SECRET-NOTE-ID',
  'SECRET-BLOCK-ID',
  'SECRET-ELEMENT',
  'SECRET-COMMENT',
  'SECRET-PENDING',
  'SECRET-REJECTED',
  'SECRET-HEALTH',
  'SECRET-EMAIL',
  'SECRET-ZONE',
  'tab-guide',
  'tab-pending',
  'tab-rejected',
  OWNER,
  'user_secret',
];

const PAGES = [
  page(
    'tab-guide',
    'Public Guide',
    [
      para('SECRET-BLOCK-ID', 'Public Guide', { style: 'title' }),
      {
        id: 'b2',
        type: 'paragraph',
        runs: [{ text: 'Visible words, ' }, { text: 'with a note.', note: 'SECRET-NOTE-ID' }],
      },
      { id: 'z1', type: 'zone', zone: 'image', width: 10, height: 10, src: 'SECRET-ZONE' },
      {
        id: 'b3',
        type: 'paragraph',
        runs: [{ text: 'A link to a private page', page: 'tab-pending' }],
      },
    ],
    {
      elements: [
        { id: 'e1', type: 'text', text: 'SECRET-ELEMENT', x: 0, y: 0, width: 10, height: 10 },
      ],
    },
  ),
  page('tab-pending', 'SECRET-PENDING title', [para('p1', 'SECRET-PENDING body words')]),
  page('tab-rejected', 'SECRET-REJECTED title', [para('r1', 'SECRET-REJECTED body words')]),
];

async function privateKnowledgebase() {
  const kit = await knowledgeKit({}, PAGES);
  const set = (tab: string, path: string, json: string) =>
    kit.db.sql
      .prepare(`UPDATE tabs SET data = json_set(data, ?, json(?)), rev = rev + 1 WHERE id = ?`)
      .run(path, json, tab);
  set(
    'tab-pending',
    '$.knowledge.approval',
    '{"state":"pending","requestedBy":"user_secret","requestedAt":1}',
  );
  set(
    'tab-rejected',
    '$.knowledge.approval',
    '{"state":"rejected","requestedBy":"user_secret","requestedAt":1}',
  );
  // Page Health: an owner, a verification, a review the room keeps on the page.
  set('tab-guide', '$.knowledge.owner', '"user_secret"');
  set('tab-guide', '$.knowledge.verified', '{"by":"user_secret","at":1,"note":"SECRET-HEALTH"}');
  // The page's draft, beside its saved writing.
  set(
    'tab-guide',
    '$.articles.draft',
    '{"blocks":[{"id":"d1","type":"paragraph","runs":[{"text":"SECRET-DRAFT"}]}]}',
  );
  set('tab-guide', '$.draft', '{"by":"Someone","at":1,"base":{}}');
  // A comment thread at the page's foot.
  kit.db.sql
    .prepare(
      `INSERT INTO page_threads (tab, id, created_at, created_by, updated_at, comments)
       VALUES ('tab-guide', 't1', 1, 'user_secret', 1, ?)`,
    )
    .run(JSON.stringify([{ text: 'SECRET-COMMENT', by: 'user_secret' }]));
  return kit;
}

const ORIGIN = 'https://www.liveknowledge.app';
const PATHS = [
  '/kb/guide',
  '/kb/guide/public-guide',
  '/kb/guide/secret-pending-title',
  '/kb/guide/secret-rejected-title',
  '/kb/guide/search?q=secret',
  '/kb/guide/search?q=visible',
  '/kb/guide/sitemap.xml',
];

describe('what is never published', () => {
  it.each([false, true])(
    'keeps every private thing off every public answer (writers shown: %s)',
    async (showWriters) => {
      const kit = await privateKnowledgebase();
      const res = await kit.call('editor', 'PUT', '/api/documents/kb/publishing', {
        address: 'guide',
        root: null,
        noindex: false,
        showWriters,
      });
      expect(res.status).toBe(200);
      const front = await handlePublicSite(new Request(`${ORIGIN}/kb/guide`), kit.db.env, () => {});
      const html = await front.text();
      expect(html).toContain('Visible words, with a note.');
      // A link to a page that is not published is its text alone.
      expect(html).toContain('<p>A link to a private page</p>');
      expect(html.includes('Written by Olive Owner')).toBe(showWriters);
      for (const path of PATHS) {
        const body = await (
          await handlePublicSite(new Request(`${ORIGIN}${path}`), kit.db.env, () => {})
        ).text();
        for (const secret of SECRETS)
          expect(body.includes(secret), `${path} holds ${secret}`).toBe(false);
      }
    },
  );

  it('answers the public site with public fields alone, field by field', async () => {
    const kit = await privateKnowledgebase();
    await kit.call('editor', 'PUT', '/api/documents/kb/publishing', {
      address: 'guide',
      root: null,
      noindex: false,
      showWriters: true,
    });
    const room = documentRoom(kit.db.env, 'kb');
    const answers = [
      await room.publishedRead({ kind: 'page', address: null }),
      await room.publishedRead({ kind: 'search', query: 'visible' }),
      await room.publishedRead({ kind: 'sitemap' }),
    ];
    for (const answer of answers) {
      expect(answer.status).toBe('ok');
      if (answer.status !== 'ok') continue;
      expect(Object.keys(answer).sort()).toEqual(expect.arrayContaining(['site', 'status']));
      expect(Object.keys(answer.site).sort()).toEqual([
        'address',
        'name',
        'noindex',
        'style',
        'tree',
      ]);
      for (const entry of answer.site.tree)
        expect(Object.keys(entry).sort()).toEqual(['address', 'icon', 'parent', 'title']);
      if (answer.page)
        expect(Object.keys(answer.page).sort()).toEqual([
          'address',
          // The cover band as drawn (published-media.ts): a picture of the page's, or a gradient.
          'cover',
          'description',
          'html',
          'icon',
          'savedAt',
          'title',
          'writers',
        ]);
      for (const result of answer.results ?? [])
        expect(Object.keys(result).sort()).toEqual(['address', 'snippet', 'title']);
      const wire = JSON.stringify(answer);
      for (const secret of SECRETS) expect(wire.includes(secret), secret).toBe(false);
    }
    expect(answers[0]).toMatchObject({ page: { writers: ['Olive Owner'] } });
    // The snapshot itself holds no private page.
    expect(kit.db.sql.prepare('SELECT tab FROM published_pages').all()).toEqual([
      { tab: 'tab-guide' },
    ]);
  });
});
