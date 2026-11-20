import { afterEach, describe, expect, it, vi } from 'vitest';
import { cpuBudgetMs, cpuNowMs } from '@liveworkspace/vitest-config/cpu-time';
import {
  exportDocumentCopy,
  importDocumentCopy,
  initDocument,
  readDocumentMeta,
} from '../document-room/document-content';
import {
  exportDocumentFile,
  importDocumentFile,
  readDocumentFile,
} from '../document-room/document-file';
import { documentSnapshotDoor } from '../document-room/document-snapshots';
import { knowledgeKit, OWNER, page, type Kit, type Who } from './knowledge-test-kit';

// The knowledgebase's Review Period (docs/specs/030-knowledgebase/verification.md "The Review Period"): one value
// on the document, set by an Editor, that every page's state follows when read.
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
  vi.useRealTimers();
});

const DAY = 86_400_000;
const SETTINGS = '/api/documents/kb/knowledge-settings';
type Settings = { knowledgeSettings: { reviewEvery: number | 'never' } };
const periodOf = async (kit: Kit, who: Who = 'viewer') =>
  (await (await kit.call(who, 'GET', SETTINGS)).json<Settings>()).knowledgeSettings.reviewEvery;
const set = (kit: Kit, reviewEvery: unknown, who: Who = 'editor') =>
  kit.call(who, 'PUT', SETTINGS, { reviewEvery });
/** A page verified `days` ago, as the room holds it after a Verify. */
const verifiedDaysAgo = (kit: Kit, tab: string, days: number, owner = OWNER) =>
  kit.db.sql
    .prepare(
      `UPDATE tabs SET data = json_set(data, '$.knowledge', json(?)), rev = rev + 1 WHERE id = ?`,
    )
    .run(JSON.stringify({ owner, verifiedAt: Date.now() - days * DAY, verifiedBy: owner }), tab);
/** Every table but the document's own row, exactly as stored: the pages, their index, trust rows and bookkeeping. */
const allButTheDocumentRow = (kit: Kit) => {
  const tables = (
    kit.db.sql
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'passages_fts%' AND name <> 'document'",
      )
      .all() as { name: string }[]
  ).map((t) => t.name);
  return Object.fromEntries(
    tables.map((t) => [t, JSON.stringify(kit.db.sql.prepare(`SELECT * FROM ${t}`).all())]),
  );
};

describe('GET knowledge-settings', () => {
  it('reads every 90 days for a knowledgebase that never chose, for every role', async () => {
    const kit = await knowledgeKit();
    for (const who of ['editor', 'participant', 'viewer', 'link', 'agent-read-only'] as const)
      expect(await periodOf(kit, who)).toBe(90);
    const document = await (
      await kit.call('viewer', 'GET', '/api/documents/kb')
    ).json<{ document: Settings }>();
    expect(document.document.knowledgeSettings).toEqual({ reviewEvery: 90 });
  });

  it.each(['page-link', 'stranger'] as const)('is closed to %s', async (who) => {
    const kit = await knowledgeKit();
    expect((await kit.call(who, 'GET', SETTINGS)).status).toBe(403);
    expect((await kit.call(who, 'GET', `${SETTINGS}/preview?reviewEvery=30`)).status).toBe(403);
  });
});

describe('PUT knowledge-settings', () => {
  it('sets the Review Period for an Editor, and every read then carries it', async () => {
    const kit = await knowledgeKit();
    const res = await set(kit, 30);
    expect([res.status, await res.json()]).toEqual([
      200,
      { knowledgeSettings: { reviewEvery: 30 } },
    ]);
    for (const who of ['participant', 'viewer', 'link'] as const)
      expect(await periodOf(kit, who)).toBe(30);
    const read = async (path: string) =>
      await (
        await kit.call('viewer', 'GET', `/api/documents/kb${path}`)
      ).json<{
        reviewEvery?: unknown;
        document?: Settings;
      }>();
    expect((await read('')).document?.knowledgeSettings).toEqual({ reviewEvery: 30 });
    expect((await read('/summary')).reviewEvery).toBe(30);
    expect((await read('/knowledge')).reviewEvery).toBe(30);
    expect((await read('/pages')).reviewEvery).toBe(30);
    expect((await read('/context')).reviewEvery).toBe(30);
    // Each period, and back to the default, which stores nothing.
    for (const every of [180, 365, 'never', 90] as const) {
      expect((await set(kit, every)).status).toBe(200);
      expect(await periodOf(kit)).toBe(every);
    }
    expect(
      kit.db.sql.prepare("SELECT knowledge_settings AS s FROM document WHERE id = 'kb'").get(),
    ).toEqual({ s: null });
  });

  it('is an Editor’s in person, or a token’s that was granted write', async () => {
    const kit = await knowledgeKit();
    expect((await set(kit, 180, 'agent')).status).toBe(200);
    expect(await periodOf(kit)).toBe(180);
  });

  it.each([
    'participant',
    'viewer',
    'link',
    'page-link',
    'stranger',
    'agent-stored',
    'agent-read-only',
    'participant-agent',
    'viewer-agent',
  ] as const)('is refused for %s, who changes nothing', async (who) => {
    const kit = await knowledgeKit();
    expect((await set(kit, 30, who)).status).toBe(403);
    expect(await periodOf(kit, 'editor')).toBe(90);
  });

  it('takes only the five periods', async () => {
    const kit = await knowledgeKit();
    const error = async (body: unknown) => {
      const res = await kit.call('editor', 'PUT', SETTINGS, body);
      return [res.status, (await res.json<{ error: string }>()).error];
    };
    for (const reviewEvery of [45, 0, '30', 'Never', null, undefined, [30]])
      expect(await error({ reviewEvery })).toEqual([400, 'invalid_review_every']);
    expect(await error([30])).toEqual([400, 'invalid_body']);
    expect(await error(null)).toEqual([400, 'invalid_body']);
    expect((await kit.call('editor', 'POST', SETTINGS, { reviewEvery: 30 })).status).toBe(405);
    expect(await periodOf(kit)).toBe(90);
  });

  it('writes one row and rewrites no page, however the period changes', async () => {
    const many = Array.from({ length: 60 }, (_, i) =>
      page(`p${i}`, `Page ${i}`, [
        { id: 'b1', type: 'paragraph', runs: [{ text: `Words ${i}.` }] },
      ]),
    );
    const kit = await knowledgeKit({}, many);
    for (const [i, p] of many.entries()) verifiedDaysAgo(kit, p.id, i * 7);
    await kit.call('editor', 'GET', '/api/documents/kb/summary');
    const before = allButTheDocumentRow(kit);
    expect(Object.keys(before)).toEqual(
      expect.arrayContaining(['tabs', 'page_trust', 'knowledge_pages', 'passages']),
    );
    const row = () =>
      kit.db.sql.prepare("SELECT knowledge_settings AS s FROM document WHERE id = 'kb'").get();
    for (const every of [30, 'never', 365] as const) {
      expect((await set(kit, every)).status).toBe(200);
      expect(row()).toEqual({ s: JSON.stringify({ reviewEvery: every }) });
      // The document's own row, and nothing else in the database: no page, trust row or index entry.
      expect(allButTheDocumentRow(kit)).toEqual(before);
    }
  });

  it('moves the last save, so the Drive file follows, and owes the room its review check', async () => {
    const kit = await knowledgeKit();
    const owed = vi.fn();
    kit.db.env.REVIEW_PERIOD_CHANGED = owed;
    const savedAt = () =>
      (
        kit.db.sql.prepare("SELECT saved_at AS at FROM document WHERE id = 'kb'").get() as {
          at: number;
        }
      ).at;
    vi.spyOn(Date, 'now').mockReturnValue(savedAt() + 5000);
    const was = savedAt();
    await set(kit, 30);
    expect(savedAt()).toBe(was + 5000);
    expect(owed).toHaveBeenCalledTimes(1);
    await set(kit, 30);
    expect(owed).toHaveBeenCalledTimes(1);
  });

  it('tells every open editor in the document-meta op, with the tab list as it stands', async () => {
    const relayed: { op: { kind: string; knowledgeSettings?: unknown; tabs?: unknown[] } }[] = [];
    const rooms = {
      idFromName: (name: string) => name,
      get: () => ({
        fetch: async (_url: string, init?: RequestInit) => {
          if (typeof init?.body === 'string')
            relayed.push(JSON.parse(init.body) as (typeof relayed)[number]);
          return new Response(null, { status: 204 });
        },
      }),
    };
    const kit = await knowledgeKit({ DOCUMENT_ROOM: rooms } as never);
    relayed.length = 0;
    await set(kit, 'never');
    const metas = JSON.stringify(relayed);
    expect(metas).toContain('"kind":"document-meta"');
    expect(metas).toContain('"knowledgeSettings":{"reviewEvery":"never"}');
    expect(metas).toContain('"id":"rollbacks"');
    expect(metas).toContain('"parent":"deploys"');
  });
});

describe('what follows the Review Period, at read time', () => {
  it('moves every page’s state, due date and the counts at once', async () => {
    const kit = await knowledgeKit();
    verifiedDaysAgo(kit, 'deploys', 100);
    verifiedDaysAgo(kit, 'rollbacks', 40);
    type Summary = { health: object; yoursToReview: { tab: string; reviewAt: number }[] };
    const summary = async () =>
      await (await kit.call('editor', 'GET', '/api/documents/kb/summary')).json<Summary>();
    type Health = { knowledge: { state: string; reviewAt?: number; verifiedAt: number } };
    const health = async (tab: string) =>
      (
        await (
          await kit.call('viewer', 'GET', `/api/documents/kb/pages/${tab}/health`)
        ).json<Health>()
      ).knowledge;

    expect((await summary()).health).toMatchObject({ verified: 1, reviewDue: 1, neverVerified: 1 });
    expect((await summary()).yoursToReview.map((p) => p.tab)).toEqual(['deploys']);

    await set(kit, 30);
    const due = await summary();
    expect(due.health).toMatchObject({ verified: 0, reviewDue: 2, neverVerified: 1 });
    // Oldest first, each with when it came due under the period.
    expect(due.yoursToReview.map((p) => p.tab)).toEqual(['deploys', 'rollbacks']);
    const rollbacks = await health('rollbacks');
    expect([rollbacks.state, rollbacks.reviewAt]).toEqual([
      'review-due',
      rollbacks.verifiedAt + 30 * DAY,
    ]);
    expect(due.yoursToReview[1]!.reviewAt).toBe(rollbacks.verifiedAt + 30 * DAY);

    await set(kit, 365);
    expect((await summary()).health).toMatchObject({ verified: 2, reviewDue: 0 });
    expect((await summary()).yoursToReview).toEqual([]);

    await set(kit, 'never');
    expect((await summary()).health).toMatchObject({ verified: 2, reviewDue: 0 });
    expect((await summary()).yoursToReview).toEqual([]);
    const never = await health('deploys');
    expect([never.state, never.reviewAt]).toEqual(['verified', undefined]);
  });

  it('moves what search prefers and what an agent is told, with no index row rewritten', async () => {
    const kit = await knowledgeKit();
    verifiedDaysAgo(kit, 'deploys', 100);
    await kit.call('editor', 'GET', '/api/documents/kb/summary');
    type Found = { results: { tab: string; trust: string; reviewAt?: number }[] };
    const found = async (who: Who) =>
      (
        await (await kit.call(who, 'GET', '/api/documents/kb/search?q=tuesdays')).json<Found>()
      ).results.find((r) => r.tab === 'deploys')!;
    type Pages = { pages: { tab: string; trust: { state: string; stale: boolean } }[] };
    const listed = async () =>
      (await (await kit.call('agent', 'GET', '/api/documents/kb/pages')).json<Pages>()).pages.find(
        (p) => p.tab === 'deploys',
      )!.trust;
    expect((await found('viewer')).trust).toBe('review-due');
    expect(await listed()).toMatchObject({ state: 'review-due', stale: true });
    await set(kit, 180);
    expect((await found('viewer')).trust).toBe('verified');
    expect((await found('agent')).reviewAt).toBeGreaterThan(Date.now());
    expect(await listed()).toMatchObject({ state: 'verified', stale: false });
  });

  it('decides whether an agent may rewrite a page: due under one period, verified under another', async () => {
    const kit = await knowledgeKit();
    verifiedDaysAgo(kit, 'holidays', 100);
    const write = async () => {
      const res = await kit.call('agent', 'PUT', '/api/documents/kb/pages/holidays', {
        markdown: 'Rewritten.',
      });
      return [res.status, (await res.json<{ error: string }>()).error];
    };
    expect(await write()).toEqual([409, 'page_review_due']);
    await set(kit, 'never');
    expect(await write()).toEqual([409, 'page_verified']);
  });
});

describe('GET knowledge-settings/preview', () => {
  const preview = (kit: Kit, every: unknown, who: Who = 'editor') =>
    kit.call(who, 'GET', `${SETTINGS}/preview?reviewEvery=${String(every)}`);

  it('says how many pages a period would make due, beside how many are due now', async () => {
    const kit = await knowledgeKit();
    verifiedDaysAgo(kit, 'deploys', 100);
    verifiedDaysAgo(kit, 'rollbacks', 40);
    verifiedDaysAgo(kit, 'holidays', 10);
    await kit.call('editor', 'GET', '/api/documents/kb/summary');
    const counts = async (every: unknown) => {
      const res = await preview(kit, every);
      expect(res.status).toBe(200);
      return await res.json<{ reviewEvery: unknown; reviewDue: number; reviewDueNow: number }>();
    };
    expect(await counts(30)).toEqual({ reviewEvery: 30, reviewDue: 2, reviewDueNow: 1 });
    expect(await counts(90)).toEqual({ reviewEvery: 90, reviewDue: 1, reviewDueNow: 1 });
    expect(await counts(365)).toEqual({ reviewEvery: 365, reviewDue: 0, reviewDueNow: 1 });
    expect(await counts('never')).toEqual({ reviewEvery: 'never', reviewDue: 0, reviewDueNow: 1 });
    // Asking changes nothing.
    expect(await periodOf(kit)).toBe(90);
  });

  it.each([
    'participant',
    'viewer',
    'link',
    'page-link',
    'stranger',
    'agent-stored',
    'viewer-agent',
  ] as const)('is refused for %s', async (who) => {
    const kit = await knowledgeKit();
    expect((await preview(kit, 30, who)).status).toBe(403);
  });

  it('takes only the five periods', async () => {
    const kit = await knowledgeKit();
    for (const every of [45, '', 'soon', '030x', '9999'])
      expect((await preview(kit, every)).status).toBe(400);
    expect((await kit.call('editor', 'GET', `${SETTINGS}/preview`)).status).toBe(400);
    expect((await kit.call('editor', 'POST', `${SETTINGS}/preview?reviewEvery=30`)).status).toBe(
      405,
    );
  });

  // The worst it can be asked: a full knowledgebase, every page verified.
  it('counts a full knowledgebase of 500 verified pages within its budget', async () => {
    const many = Array.from({ length: 500 }, (_, i) => page(`p${i}`, `Page ${i}`, []));
    const kit = await knowledgeKit({}, many);
    kit.db.sql.exec(
      `INSERT OR REPLACE INTO page_trust (tab, title, verified_at)
         SELECT id, name, ${Date.now()} - rowid * ${DAY} FROM tabs`,
    );
    await preview(kit, 30);
    const t0 = cpuNowMs();
    const res = await preview(kit, 30);
    const cpu = cpuNowMs() - t0;
    const counted = await res.json<{ reviewDue: number; reviewDueNow: number }>();
    console.info('[measured] review period preview of 500 verified pages', {
      cpuMs: Math.round(cpu),
    });
    expect(counted.reviewDue).toBe(471);
    expect(counted.reviewDueNow).toBe(411);
    expect(cpu).toBeLessThan(cpuBudgetMs(50));
  });
});

describe('the Review Period travels with the knowledgebase', () => {
  const env = (kit: Kit) => kit.db.env;
  const start = (kit: Kit, id: string) =>
    initDocument(env(kit), id, {
      name: 'Copy',
      ownerId: OWNER,
      teamId: null,
      source: null,
      savedAt: 2,
      createdAt: 2,
    });
  const stored = async (kit: Kit, id: string) =>
    (await readDocumentMeta(env(kit), id))?.knowledgeSettings;

  it('goes with a copy of the whole knowledgebase, and not with a copy of one page', async () => {
    const kit = await knowledgeKit();
    await set(kit, 180);
    const whole = await exportDocumentCopy(env(kit), 'kb', null, null);
    expect(whole?.knowledgeSettings).toEqual({ reviewEvery: 180 });
    await importDocumentCopy(env(kit), 'copy', whole!);
    // The copy starts on its first open, as its new owner's, and keeps the period it came with.
    await start(kit, 'copy');
    expect(await stored(kit, 'copy')).toEqual({ reviewEvery: 180 });
    const one = await exportDocumentCopy(env(kit), 'kb', 'holidays', null);
    expect(one).not.toHaveProperty('knowledgeSettings');
    // The default is not carried: a copy of a knowledgebase that never chose reads as every 90 days.
    await set(kit, 90);
    expect(await exportDocumentCopy(env(kit), 'kb', null, null)).not.toHaveProperty(
      'knowledgeSettings',
    );
  });

  it('is in the Drive file and the export, and a file read back makes a knowledgebase with it', async () => {
    const kit = await knowledgeKit();
    await set(kit, 'never');
    const file = await exportDocumentFile(env(kit), 'kb', null);
    if (file.status !== 'ok' || typeof file.body !== 'string') throw new Error('no file');
    const written = JSON.parse(file.body) as { document: { knowledgeSettings?: unknown } };
    expect(written.document.knowledgeSettings).toEqual({ reviewEvery: 'never' });
    const read = readDocumentFile(file.body);
    if (!read.ok) throw new Error(read.failure);
    expect(read.content.knowledgeSettings).toEqual({ reviewEvery: 'never' });
    await importDocumentFile(env(kit), 'fromfile', { ...read.content, name: 'F', ownerId: OWNER });
    expect(await stored(kit, 'fromfile')).toEqual({ reviewEvery: 'never' });
  });

  it('comes back with a snapshot that is reverted to', async () => {
    const kit = await knowledgeKit();
    await set(kit, 30);
    const door = documentSnapshotDoor(env(kit), 'kb');
    const snapshot = (await door.exportFile())!;
    await set(kit, 365);
    expect(await door.replaceContent(snapshot)).toBe('ok');
    expect(await periodOf(kit)).toBe(30);
    // A snapshot from before the knowledgebase chose reverts to the default.
    await set(kit, 90);
    const plain = (await door.exportFile())!;
    await set(kit, 180);
    await door.replaceContent(plain);
    expect(await periodOf(kit)).toBe(90);
  });

  it('is taken from the create that syncs a knowledgebase kept Offline, when it is one the api knows', async () => {
    const kit = await knowledgeKit();
    const create = (id: string, knowledgeSettings: unknown) =>
      kit.call('editor', 'POST', '/api/documents', { id, name: 'Synced', knowledgeSettings });
    expect((await create('synced', { reviewEvery: 365 })).status).toBeLessThan(300);
    expect(await stored(kit, 'synced')).toEqual({ reviewEvery: 365 });
    expect((await create('odd', { reviewEvery: 'weekly' })).status).toBeLessThan(300);
    expect(await stored(kit, 'odd')).toEqual({ reviewEvery: 90 });
  });
});
