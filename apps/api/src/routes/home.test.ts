import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextFrecencyKey, type HomeResponse, type HomeTimelinePage } from '@livediagram/api-schema';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { recordDocumentOpen } from '../home/record-open';
import {
  recordActionAssigned,
  recordCommentAdded,
  recordDocumentCreated,
  recordDocumentEdited,
  recordTeamDocumentAdded,
  backfillUserScope,
} from '../timeline';
import type { Env } from '../types';
import { makeTestRouteContext } from './test-route-context';
import { handleHome } from './home';

// Explorer Home's reads (docs/specs/013-workspace/explorer-home.md; blueprint "Reads",
// "Interfaces and contracts", "Security and trust"), against the real schema.

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
// 2023-11-14 22:13:20 UTC.
const NOW = 1_700_000_000_000;
const ME = 'user_me';
let db: SqliteD1;
let logs: string[];
let pending: Promise<unknown>[];

type Doc = { id: string; name: string; ownerId: string; teamId: string | null };
const docs: Record<string, Doc> = {};

function addDoc(
  id: string,
  ownerId: string,
  opts: { teamId?: string; folderId?: string; trashed?: boolean; shareable?: boolean } = {},
) {
  db.sql
    .prepare(
      `INSERT INTO documents (id, owner_id, name, shareable, team_id, folder_id, saved_at, created_at, trashed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      ownerId,
      `Doc ${id}`,
      opts.shareable ? 1 : 0,
      opts.teamId ?? null,
      opts.folderId ?? null,
      NOW - 5 * DAY,
      NOW - 30 * DAY,
      opts.trashed ? NOW - DAY : null,
    );
  docs[id] = { id, name: `Doc ${id}`, ownerId, teamId: opts.teamId ?? null };
}

function shareWithMe(
  documentId: string,
  code: string,
  opts: { tabId?: string; expired?: boolean } = {},
) {
  db.sql
    .prepare(
      `INSERT INTO share_links (code, document_id, role, tab_id, created_at, expires_at)
       VALUES (?, ?, 'view', ?, 1, ?)`,
    )
    .run(code, documentId, opts.tabId ?? null, opts.expired ? NOW - DAY : null);
  db.sql
    .prepare(
      `INSERT INTO shared_with (owner_id, document_id, role, tab_id, last_seen) VALUES (?, ?, 'view', ?, 1)`,
    )
    .run(ME, documentId, opts.tabId ?? null);
}

function seed() {
  db.sql.exec(`
    INSERT INTO teams (id, name, organisation, created_at, updated_at) VALUES ('team-1', 'Platform', NULL, 1, 1);
    INSERT INTO teams (id, name, organisation, created_at, updated_at) VALUES ('team-2', 'Other', NULL, 1, 1);
    INSERT INTO team_members (id, team_id, user_id, role, status, created_at, updated_at) VALUES
      ('m1', 'team-1', '${ME}', 'member', 'joined', 1, 1),
      ('m2', 'team-1', 'user_priya', 'admin', 'joined', 1, 1),
      ('m3', 'team-1', 'user_sam', 'member', 'joined', 1, 1),
      ('m4', 'team-2', '${ME}', 'member', 'invited', 1, 1);
    INSERT INTO folders (id, owner_id, parent_id, team_id, name, created_at, updated_at)
      VALUES ('f1', '${ME}', NULL, NULL, 'Architecture', 1, 1);
    INSERT INTO participants (id, name, color, created_at) VALUES
      ('user_priya', 'Priya', '#e11d48', 1), ('user_sam', 'Sam', '#0ea5e9', 1), ('user_lee', 'Lee', '#22c55e', 1);
    INSERT INTO owner_aliases (owner_id, alias_id, created_at) VALUES ('${ME}', 'guest-me', 1);
  `);
  addDoc('own1', ME, { folderId: 'f1' });
  addDoc('own2', ME);
  addDoc('team1', 'user_priya', { teamId: 'team-1' });
  addDoc('shared1', 'user_lee', { shareable: true, folderId: undefined });
  addDoc('scoped', 'user_lee', { shareable: true });
  addDoc('lapsed', 'user_lee', { shareable: true });
  addDoc('trashed', ME, { trashed: true });
  addDoc('other-team', 'user_priya', { teamId: 'team-2' });
  shareWithMe('shared1', 'LIVE');
  shareWithMe('scoped', 'SCOPED', { tabId: 'tab-x' });
  shareWithMe('lapsed', 'GONE', { expired: true });
}

function at(time: number) {
  vi.setSystemTime(time);
}

async function get(path: string, opts: { owner?: string; env?: Env } = {}) {
  const res = await handleHome(
    makeTestRouteContext('GET', path, {
      env: opts.env ?? db.env,
      owner: opts.owner ?? ME,
      clerkUserId: opts.owner ?? ME,
      waitUntil: (p) => void pending.push(p),
    }),
  );
  return res;
}

async function home(path = '/api/home', owner = ME): Promise<HomeResponse> {
  const res = await get(path, { owner });
  expect(res.status).toBe(200);
  return (await res.json()) as HomeResponse;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  at(NOW);
  db = sqliteD1();
  logs = [];
  pending = [];
  const capture = (...args: unknown[]) => void logs.push(args.map(String).join(' '));
  vi.spyOn(console, 'info').mockImplementation(capture);
  vi.spyOn(console, 'warn').mockImplementation(capture);
  vi.spyOn(console, 'error').mockImplementation(capture);
  seed();
  // The Timeline user scope counts as seeded unless a test says otherwise.
  db.sql.exec(
    `INSERT INTO timeline_scope_state (scope_type, scope_id, backfilled_at) VALUES ('user', '${ME}', 1)`,
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Jump back in', () => {
  it('ranks by frecency, over documents the person can still open', async () => {
    for (const d of [3, 2, 1]) await recordDocumentOpen(db.env, docs.own1!, ME, NOW - d * DAY);
    await recordDocumentOpen(db.env, docs.own2!, ME, NOW - HOUR);
    await recordDocumentOpen(db.env, docs.shared1!, ME, NOW - 2 * HOUR);
    for (const id of ['trashed', 'lapsed', 'other-team', 'scoped']) {
      await recordDocumentOpen(db.env, docs[id]!, ME, NOW);
    }

    const { jumpBackIn } = await home();
    expect(jumpBackIn.map((d) => d.documentId)).toEqual(['own1', 'scoped', 'own2', 'shared1']);
    expect(jumpBackIn[0]).toMatchObject({
      name: 'Doc own1',
      via: 'own',
      folderId: 'f1',
      folderName: 'Architecture',
      openDays: 3,
      lastOpenedAt: NOW - DAY,
      shareCode: null,
    });
    // The key travels, so the view can rank this browser's local documents among these.
    const keys = jumpBackIn.map((d) => d.frecencyKey);
    expect(keys).toEqual([...keys].sort((a, b) => b - a));
    expect(jumpBackIn[2]!.frecencyKey).toBe(nextFrecencyKey(null, NOW - HOUR));
    expect(jumpBackIn[1]).toMatchObject({ via: 'shared', shareCode: 'SCOPED', tabId: 'tab-x' });
    expect(jumpBackIn[3]).toMatchObject({
      via: 'shared',
      shareCode: 'LIVE',
      teamId: null,
      folderId: null,
      ownerName: 'Lee',
    });
  });

  it("is seeded on the person's first Home from the days they really edited", async () => {
    for (const d of [4, 3]) {
      at(NOW - d * DAY);
      await recordDocumentEdited(db.env, docs.own2!, ME);
    }
    at(NOW);
    const { jumpBackIn } = await home();
    expect(jumpBackIn.map((d) => [d.documentId, d.openDays])).toEqual([['own2', 2]]);
    expect(logs).toContain('home: frecency-seeded docs=1 days=2 conflicts=0 capped=no');
    await home();
    expect(logs.filter((l) => l.startsWith('home: frecency-seeded'))).toHaveLength(1);
  });

  it('logs a failed seed and still answers', async () => {
    const broken = {
      ...db.env,
      DB: {
        ...db.env.DB,
        prepare: (query: string) => {
          if (
            query.includes('FROM document_opens WHERE owner_id = ?1') &&
            !query.includes('JOIN')
          ) {
            throw new Error('d1 down');
          }
          return db.env.DB.prepare(query);
        },
      },
    } as Env;
    expect((await get('/api/home', { env: broken })).status).toBe(200);
    expect(logs.some((l) => l.startsWith('home: frecency-seed-failed'))).toBe(true);
    const stamp = db.sql
      .prepare('SELECT frecency_seeded_at FROM timeline_scope_state WHERE scope_id = ?')
      .get(ME) as { frecency_seeded_at: number | null };
    expect(stamp.frecency_seeded_at).toBeNull();
  });

  it('holds at most twelve', async () => {
    for (let i = 0; i < 14; i += 1) {
      addDoc(`many${i}`, ME);
      await recordDocumentOpen(db.env, docs[`many${i}`]!, ME, NOW - i * HOUR);
    }
    expect((await home()).jumpBackIn).toHaveLength(12);
  });
});

describe('Timeline', () => {
  async function emitOwn() {
    at(NOW - 3 * HOUR);
    await recordDocumentCreated(db.env, docs.own2!, ME);
    at(NOW - 2 * HOUR);
    await recordDocumentEdited(db.env, docs.own2!, ME);
    at(NOW - 2 * HOUR + 60_000);
    await recordDocumentEdited(db.env, docs.shared1!, ME);
    await recordDocumentEdited(db.env, docs.trashed!, ME);
    await recordDocumentEdited(db.env, docs.team1!, 'user_priya');
    at(NOW);
    await recordDocumentOpen(db.env, docs.own1!, ME, NOW - HOUR);
  }

  it("lists the person's own created, updated and opened, newest first", async () => {
    await emitOwn();
    const { timeline } = await home();
    expect(timeline.items.map((e) => [e.documentId, e.kind])).toEqual([
      ['own1', 'opened'],
      ['shared1', 'updated'],
      ['own2', 'updated'],
      ['own2', 'created'],
    ]);
    expect(timeline.nextCursor).toBeNull();
    expect(timeline.items[1]).toMatchObject({ via: 'shared', shareCode: 'LIVE' });
  });

  it("leaves out the backfill's reconstructed edits: only real actors count", async () => {
    await backfillUserScope(db.env, ME);
    const { timeline } = await home();
    expect(timeline.items.map((e) => e.kind)).not.toContain('updated');
    expect(timeline.items.map((e) => `${e.documentId}:${e.kind}`).sort()).toEqual([
      'own1:created',
      'own2:created',
    ]);
  });

  it('pages by keyset', async () => {
    await emitOwn();
    const first = await home('/api/home?limit=2');
    expect(first.timeline.items).toHaveLength(2);
    expect(first.timeline.nextCursor).toMatch(/^\d+:/);
    expect((await get('/api/home/timeline?limit=1')).status).toBe(200);
    expect(logs).toContain('home: timeline-page items=1 more=yes');
    const res = await get(
      `/api/home/timeline?limit=2&cursor=${encodeURIComponent(first.timeline.nextCursor!)}`,
    );
    expect(res.status).toBe(200);
    const next = (await res.json()) as HomeTimelinePage;
    expect(next.items.map((e) => [e.documentId, e.kind])).toEqual([
      ['own2', 'updated'],
      ['own2', 'created'],
    ]);
    expect(next.nextCursor).toBeNull();
    expect(logs).toContain('home: timeline-page items=2 more=no');
  });
});

describe('What happened', () => {
  async function emitOthers() {
    at(NOW - 4 * HOUR);
    await recordTeamDocumentAdded(db.env, docs.team1!, 'Platform', 'user_sam');
    at(NOW - 3 * HOUR);
    await recordCommentAdded(
      db.env,
      docs.team1!,
      { id: 'c1', text: 'Looks good', authorName: 'Priya', reply: false },
      'user_priya',
    );
    at(NOW - 2 * HOUR);
    await recordDocumentEdited(db.env, docs.team1!, 'user_sam');
    at(NOW - HOUR);
    await recordActionAssigned(
      db.env,
      docs.team1!,
      { id: 'a1', name: 'Wire webhooks', assigneeId: 'guest-me', assigneeName: 'Me' },
      'user_priya',
    );
    at(NOW - HOUR - 60_000);
    await recordDocumentEdited(db.env, docs.shared1!, 'user_lee');
    // Not for the reader: on a tab-scoped share, by themself, an open, too old.
    await recordDocumentEdited(db.env, docs.scoped!, 'user_lee');
    await recordCommentAdded(
      db.env,
      docs.team1!,
      { id: 'c2', text: 'Mine', authorName: 'Me', reply: true },
      ME,
    );
    await recordDocumentEdited(db.env, docs.own1!, 'guest-me');
    await recordDocumentOpen(db.env, docs.team1!, 'user_sam', NOW - HOUR);
    at(NOW - 15 * DAY);
    await recordDocumentEdited(db.env, docs.own2!, 'user_priya');
    at(NOW);
  }

  it("groups other people's actions per document per day", async () => {
    await emitOthers();
    const { whatHappened } = await home();
    expect(whatHappened.map((g) => g.id)).toEqual(['team1:2023-11-14', 'shared1:2023-11-14']);

    const [team, shared] = whatHappened;
    expect(team).toMatchObject({
      documentId: 'team1',
      via: 'team',
      teamName: 'Platform',
      day: '2023-11-14',
      summary: true,
      total: 4,
      latestAt: NOW - HOUR,
      verbs: [
        { verb: 'commented', count: 1 },
        { verb: 'edited', count: 1 },
        { verb: 'assigned_you', count: 1 },
        { verb: 'shared', count: 1 },
      ],
    });
    expect(team!.people.map((p) => p.name)).toEqual(['Priya', 'Sam']);
    expect(team!.actions.map((a) => [a.verb, a.personId, a.detail])).toEqual([
      ['assigned_you', 'user_priya', 'Wire webhooks'],
      ['edited', 'user_sam', null],
      ['commented', 'user_priya', 'Looks good'],
      ['shared', 'user_sam', 'Platform'],
    ]);
    expect(shared).toMatchObject({
      summary: false,
      via: 'shared',
      shareCode: 'LIVE',
      teamId: null,
    });
  });

  it("groups by the reader's day", async () => {
    await emitOthers();
    const { whatHappened } = await home('/api/home?tz=Pacific%2FAuckland');
    expect(whatHappened.map((g) => g.day)).toEqual(['2023-11-15', '2023-11-15']);
  });

  it("never shows anyone else the person's opens", async () => {
    await recordDocumentOpen(db.env, docs.team1!, ME, NOW);
    const priya = await home('/api/home', 'user_priya');
    expect(priya.whatHappened).toEqual([]);
    expect(priya.timeline.items).toEqual([]);
    expect(priya.jumpBackIn).toEqual([]);
  });

  it('still names the action when a snapshot cannot be parsed', async () => {
    const event = db.sql.prepare(
      `INSERT INTO timeline_events (id, actor_id, source_type, source_id, event_type, title,
         description, occurred_at, snapshot, created_at)
       VALUES (?1, 'user_priya', 'document', ?1, 'comment_added', 'Comment Added', 'Hi', ?2, ?3, 1)`,
    );
    const scope = db.sql.prepare(
      `INSERT INTO timeline_event_scopes (event_id, scope_type, scope_id, added_at)
       VALUES (?, 'document', 'team1', 1)`,
    );
    event.run('bad-json', NOW - 1000, '{not json');
    event.run('bad-shape', NOW - 2000, '[1, 2]');
    scope.run('bad-json');
    scope.run('bad-shape');
    const { whatHappened } = await home();
    expect(whatHappened[0]!.actions.map((a) => [a.id, a.verb])).toEqual([
      ['bad-json', 'commented'],
      ['bad-shape', 'commented'],
    ]);
  });

  it('logs when the read reaches its cap', async () => {
    const event = db.sql.prepare(
      `INSERT INTO timeline_events (id, actor_id, source_type, source_id, event_type, title,
         description, occurred_at, snapshot, created_at)
       VALUES (?, 'user_priya', 'document', ?, 'comment_added', 'Comment Added', 'x', ?, '{}', 1)`,
    );
    const scope = db.sql.prepare(
      `INSERT INTO timeline_event_scopes (event_id, scope_type, scope_id, added_at)
       VALUES (?, 'document', 'team1', 1)`,
    );
    for (let i = 0; i < 201; i += 1) {
      event.run(`n${i}`, `n${i}`, NOW - i * 1000);
      scope.run(`n${i}`);
    }
    const { whatHappened } = await home();
    expect(whatHappened[0]!.total).toBe(200);
    expect(logs).toContain('home: what-happened-capped max=200');
  });
});

describe('the read', () => {
  it('answers an empty Home for someone with nothing yet', async () => {
    const body = await home('/api/home', 'guest-new');
    expect(body).toEqual({
      jumpBackIn: [],
      timeline: { items: [], nextCursor: null },
      whatHappened: [],
      lastSeenAt: null,
    });
    expect(logs).toContain('home: read jump=0 timeline=0 groups=0 actions=0');
  });

  it('seeds the Timeline user scope on first sight, off the response path', async () => {
    db.sql.exec(`DELETE FROM timeline_scope_state`);
    await home();
    await Promise.all(pending);
    const created = db.sql
      .prepare(
        `SELECT COUNT(*) AS n FROM timeline_events WHERE event_type = 'document_created' AND actor_id = ?`,
      )
      .get(ME) as { n: number };
    expect(created.n).toBeGreaterThan(0);
    expect(logs).toContain('home: backfill-dispatched');
  });

  it('logs a failed seed rather than losing it', async () => {
    db.sql.exec('DELETE FROM timeline_scope_state');
    const broken = {
      ...db.env,
      DB: {
        ...db.env.DB,
        prepare: (query: string) => {
          if (query.includes('SELECT id, name, created_at, saved_at FROM documents')) {
            throw new Error('d1 down');
          }
          return db.env.DB.prepare(query);
        },
      },
    } as Env;
    expect((await get('/api/home', { env: broken })).status).toBe(200);
    await Promise.all(pending);
    expect(logs.some((l) => l.startsWith('home: backfill-failed'))).toBe(true);
  });

  it('moves the unread mark once per visit and says where it stood', async () => {
    db.sql.exec(`UPDATE timeline_scope_state SET last_seen_at = ${NOW - 2 * HOUR}`);
    expect((await home()).lastSeenAt).toBe(NOW - 2 * HOUR);
    await Promise.all(pending);
    expect(logs).toContain('home: seen-marked');
    at(NOW + 10_000);
    // Inside the visit window the mark stays, so the New markers survive a second read.
    expect((await home()).lastSeenAt).toBe(NOW);
    await Promise.all(pending);
    expect(logs.filter((l) => l === 'home: seen-marked')).toHaveLength(1);
  });

  it('leaves the mark alone on a later Timeline page', async () => {
    await get('/api/home/timeline');
    await Promise.all(pending);
    const row = db.sql
      .prepare('SELECT last_seen_at FROM timeline_scope_state WHERE scope_id = ?')
      .get(ME) as { last_seen_at: number | null };
    expect(row.last_seen_at).toBeNull();
  });

  it.each([
    ['/api/home?tz=Mars%2FOlympus', 'tz_invalid'],
    ['/api/home?limit=0', 'limit_invalid'],
    ['/api/home?limit=101', 'limit_invalid'],
    ['/api/home?limit=2.5', 'limit_invalid'],
    ['/api/home/timeline?cursor=junk', 'cursor_invalid'],
    ['/api/home/timeline?cursor=12%3A', 'cursor_invalid'],
  ])('refuses %s as %s', async (path, token) => {
    const res = await get(path);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: token });
    expect(logs).toContain(`home: rejected reason=${token}`);
  });

  it('is rate limited per owner', async () => {
    const limit = vi.fn(async () => ({ success: false }));
    const res = await get('/api/home', { env: { ...db.env, HOME_RATE_LIMITER: { limit } } });
    expect(res.status).toBe(429);
    expect(limit).toHaveBeenCalledWith({ key: ME });
    expect(logs).toContain('home: rate-limited');
  });

  it('needs an identity, and answers nothing else', async () => {
    const anonymous = await handleHome(makeTestRouteContext('GET', '/api/home', { env: db.env }));
    expect(anonymous.status).toBe(400);
    const post = await handleHome(
      makeTestRouteContext('POST', '/api/home', { env: db.env, owner: ME }),
    );
    expect(post.status).toBe(404);
    expect((await get('/api/home/elsewhere')).status).toBe(404);
    expect((await get('/api/timeline')).status).toBe(404);
  });
});
