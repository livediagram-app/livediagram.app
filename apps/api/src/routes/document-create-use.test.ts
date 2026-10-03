import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DOCUMENT_CONVERSION_HEADER, type HomeResponse } from '@livediagram/api-schema';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { recordDocumentOpen } from '../home/record-open';
import { getDocument } from '../db';
import { backfillUserScope } from '../timeline';
import { makeTestRouteContext } from './test-route-context';
import { handleDocuments } from './documents';
import { handleHome } from './home';
import { asUser } from './placement-test-support';

// Making a document is a use, a bulk import is not (docs/specs/013-workspace/explorer-home.md
// "Making a document"; docs/specs/015-api/api.md "Marking a document used"; blueprint "Recording a
// making"), end to end through the create route and the Home read, against the real schema.

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
// 2023-11-14 19:13:20 UTC: NOW + 4 h is the same UTC day, NOW + 6 h the next.
const NOW = 1_700_000_000_000 - 3 * HOUR;
const ME = 'user_me';
let db: SqliteD1;
let logs: string[];
let pending: Promise<unknown>[];

const waitUntil = (p: Promise<unknown>) => void pending.push(p);

async function settle(): Promise<void> {
  while (pending.length > 0) await Promise.all(pending.splice(0));
}

async function create(
  id: string,
  extra: Record<string, unknown> = {},
  headers: Record<string, string> = {},
): Promise<Response> {
  const res = await handleDocuments(
    makeTestRouteContext('POST', '/api/documents', {
      env: db.env,
      ...asUser(ME),
      headers,
      waitUntil,
      body: {
        id,
        name: `Doc ${id}`,
        tabs: [{ id: `${id}-t1`, name: 'Tab 1', elements: [] }],
        ...extra,
      },
    }),
  );
  await settle();
  return res;
}

async function copy(id: string): Promise<string> {
  const res = await handleDocuments(
    makeTestRouteContext('POST', `/api/documents/${id}/copy`, {
      env: db.env,
      ...asUser(ME),
      waitUntil,
      body: {},
    }),
  );
  expect(res.status).toBe(201);
  await settle();
  return ((await res.json()) as { document: { id: string } }).document.id;
}

/** The editor opening the document at `at`; the clock moves on to it when it is later. */
async function open(id: string, at: number): Promise<void> {
  if (at > Date.now()) vi.setSystemTime(at);
  const doc = await getDocument(db.env, id);
  await recordDocumentOpen(db.env, doc!, ME, at);
}

async function jumpBackIn(): Promise<[string, number, number][]> {
  const res = await handleHome(
    makeTestRouteContext('GET', '/api/home', { env: db.env, ...asUser(ME), waitUntil }),
  );
  expect(res.status).toBe(200);
  await settle();
  const { jumpBackIn: items } = (await res.json()) as HomeResponse;
  return items.map((d) => [d.documentId, d.useDays, d.lastUsedAt]);
}

const createdEvents = (id: string) =>
  db.sql
    .prepare(
      `SELECT COUNT(*) AS n FROM timeline_events WHERE source_id = ? AND event_type = 'document_created'`,
    )
    .get(id) as { n: number };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  db = sqliteD1();
  logs = [];
  pending = [];
  const capture = (...args: unknown[]) => void logs.push(args.map(String).join(' '));
  vi.spyOn(console, 'info').mockImplementation(capture);
  vi.spyOn(console, 'warn').mockImplementation(capture);
  vi.spyOn(console, 'error').mockImplementation(capture);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('making a document', () => {
  it('counts a single create as a use: in Jump back in without being opened', async () => {
    expect((await create('d1')).status).toBe(201);

    expect(await jumpBackIn()).toEqual([['d1', 1, NOW]]);
    expect(logs).toContain('home: making doc=d1 marked=true');
  });

  it('counts an explicit markUsed: true the same', async () => {
    await create('d1', { markUsed: true });
    expect(await jumpBackIn()).toEqual([['d1', 1, NOW]]);
  });

  it('leaves out a create that says markUsed: false, as a bulk import does, still in the Timeline', async () => {
    expect((await create('d1', { markUsed: false })).status).toBe(201);

    expect(await jumpBackIn()).toEqual([]);
    expect(createdEvents('d1').n).toBe(1);
    expect(logs).toContain('home: making doc=d1 marked=false');
  });

  it('joins an opted-out document at its first open', async () => {
    await create('d1', { markUsed: false });
    await open('d1', NOW + HOUR);
    expect(await jumpBackIn()).toEqual([['d1', 1, NOW + HOUR]]);
  });

  it('counts a making and an open on one UTC day once, and the next day again', async () => {
    await create('d1');
    await open('d1', NOW + HOUR / 2);
    expect(await jumpBackIn()).toEqual([['d1', 1, NOW + HOUR / 2]]);

    await open('d1', NOW + 4 * HOUR);
    expect(await jumpBackIn()).toEqual([['d1', 1, NOW + 4 * HOUR]]);

    await open('d1', NOW + 6 * HOUR);
    expect(await jumpBackIn()).toEqual([['d1', 2, NOW + 6 * HOUR]]);
  });

  it('counts on the day it is made, whatever dates of its own the create carries', async () => {
    await create('d1', { createdAt: NOW - 400 * DAY, savedAt: NOW - 300 * DAY });
    expect(await jumpBackIn()).toEqual([['d1', 1, NOW]]);
  });

  it('places a fresh making among older uses by its moment', async () => {
    await create('old', { markUsed: false });
    for (const d of [3, 2, 1]) await open('old', NOW - d * DAY);
    vi.setSystemTime(NOW + HOUR / 2);
    await create('new');

    expect(await jumpBackIn()).toEqual([
      ['old', 3, NOW - DAY],
      ['new', 1, NOW + HOUR / 2],
    ]);
  });

  it('refuses a markUsed that is not a boolean, creating nothing', async () => {
    const res = await create('d1', { markUsed: 'false' });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'bad_request', message: 'invalid markUsed' });
    expect(await getDocument(db.env, 'd1')).toBeNull();
    expect(logs).toContain('documents: rejected reason=mark_used_invalid');
  });

  it('counts a duplicate made through the copy route', async () => {
    await create('d1', { markUsed: false });
    const copyId = await copy('d1');
    expect(await jumpBackIn()).toEqual([[copyId, 1, NOW]]);
  });

  it('never counts a sync from Offline Mode: moving a document is not making it', async () => {
    await create('d1', { markUsed: true }, { [DOCUMENT_CONVERSION_HEADER]: 'sync' });
    expect(await jumpBackIn()).toEqual([]);
  });

  it('never counts a re-commit of an id the caller already owns', async () => {
    await create('d1', { markUsed: false });
    await create('d1', { markUsed: true });
    expect(await jumpBackIn()).toEqual([]);
  });

  it('keeps the mark when the Timeline backfill reconstructs the creation', async () => {
    await create('d1');
    await backfillUserScope(db.env, ME);
    expect(createdEvents('d1').n).toBe(1);
    expect(await jumpBackIn()).toEqual([['d1', 1, NOW]]);
  });
});
