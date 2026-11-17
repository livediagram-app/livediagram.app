import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nodeItemSql } from '@liveworkspace/index-app/testing';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import type { Env } from '../types';
import { recordImageGrant } from './image-grants';
import {
  IMAGE_RELEASE_ATTEMPTS_MAX,
  IMAGE_RELEASE_GRACE_MS,
  IMAGE_RELEASE_RETRY_MS,
  IMAGE_RELEASE_TIMEOUT_MS,
  IMAGE_RELEASES_PER_WAKE,
  nextImageReleaseAt,
  planStillHolds,
  releaseDueImages,
  stampImageReleases,
} from './image-release';
import { drainIndex } from './plan-room-content';
import { planNamespace } from './test-plan-namespace';

// Pictures a card no longer holds leave storage (docs/specs/026-plan/items.md "Removed pictures"): the plan's
// triggers note each picture a write took off a card, the drain starts its grace, and once it is over the plan asks the
// media service to release each one nothing in the plan still names. The service is a recording fake behind `fetch`.

const PLAN = 'plan-1';
const MEDIA_URL = 'https://media.test/api/media';

let released: string[];
// What the fake service answers a release: released, kept, a failure, or nothing at all.
let answer: 'released' | 'kept' | 'fail' | 'silent';
// Run as the service takes a release, before it answers: a request reaching the room meanwhile.
let duringRelease: (() => void) | null;

beforeEach(() => {
  released = [];
  answer = 'released';
  duringRelease = null;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const u = new URL(String(url));
      if (u.pathname.endsWith('/release')) {
        if (answer === 'fail') return Response.json({ error: 'down' }, { status: 503 });
        if (answer === 'silent') return new Promise<Response>(() => {});
        duringRelease?.();
        released.push(
          `${decodeURIComponent(u.pathname.split('/').at(-2)!)}@${u.searchParams.get('document')}`,
        );
        return Response.json(
          answer === 'released' ? { released: true } : { released: false, reason: 'referenced' },
        );
      }
      if (u.pathname.endsWith('/app/refs')) return Response.json({ ok: true });
      return Response.json({ error: 'not_found' }, { status: 404 });
    }),
  );
  vi.spyOn(console, 'info').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const pic = (id: string) => ({ id, name: `${id}.png`, size: 100, type: 'image/png' });

function plan(base: Partial<Env> = { MEDIA_KEY: 'k', MEDIA_URL }) {
  const db: SqliteD1 = sqliteD1(base);
  db.sql.prepare('INSERT INTO plan (id, saved_at, created_at) VALUES (?, 1, 1)').run(PLAN);
  let key = 0;
  const card = (id: string, fields: Record<string, unknown>) => {
    key += 1;
    db.sql
      .prepare(
        `INSERT INTO items (plan_id, id, type, item_key, rank, fields, rev, created_at, updated_at, created_by, updated_by)
         VALUES (?, ?, 'task', ?, 'a', ?, 1, 1, 1, '{}', '{}')`,
      )
      .run(PLAN, id, key, JSON.stringify(fields));
  };
  const edit = (id: string, fields: Record<string, unknown>) =>
    db.sql
      .prepare('UPDATE items SET fields = ? WHERE plan_id = ? AND id = ?')
      .run(JSON.stringify(fields), PLAN, id);
  const remove = (id: string) =>
    db.sql.prepare('DELETE FROM items WHERE plan_id = ? AND id = ?').run(PLAN, id);
  const noted = () =>
    db.sql
      .prepare('SELECT image_id, due_at FROM image_releases ORDER BY image_id')
      .all()
      .map((r) => ({ id: r.image_id as string, due: r.due_at as number | null }));
  const grant = (id: string) => recordImageGrant(nodeItemSql(db.sql), PLAN, id, 1);
  const stamp = (now: number) => stampImageReleases(db.env, PLAN, now);
  return { ...db, card, edit, remove, noted, grant, stamp };
}

describe('what a write takes off a card', () => {
  it('notes a removed attachment, and nothing a card still holds', () => {
    const p = plan();
    p.card('a', { attachments: [pic('one'), pic('two')] });
    p.edit('a', { attachments: [pic('two')] });
    expect(p.noted()).toEqual([{ id: 'one', due: null }]);
    p.edit('a', { title: 'renamed', attachments: [pic('two')] });
    expect(p.noted()).toEqual([{ id: 'one', due: null }]);
  });

  it('notes a cleared Image field and one picture of a Several Images list, granted ones only', () => {
    const p = plan();
    p.grant('photo');
    p.grant('g1');
    p.grant('g2');
    p.card('a', { photo: 'photo', gallery: ['g1', 'g2'], note: 'not-a-picture' });
    p.edit('a', { gallery: ['g2'], note: '' });
    expect(p.noted().map((n) => n.id)).toEqual(['g1', 'photo']);
  });

  it('notes every picture of a card deleted for good', () => {
    const p = plan();
    p.grant('photo');
    p.card('a', { photo: 'photo', attachments: [pic('one')] });
    p.remove('a');
    expect(p.noted().map((n) => n.id)).toEqual(['one', 'photo']);
  });

  it('notes nothing on a plan with no pictures, nor for attachments that are not pictures', () => {
    const p = plan();
    p.card('a', { title: 'plain' });
    p.edit('a', { title: 'still plain' });
    p.grant('x');
    p.edit('a', { attachments: 'not a list' });
    p.edit('a', { attachments: [{ id: 7 }, 'loose'] });
    p.edit('a', {});
    expect(p.noted()).toEqual([]);
  });

  it('starts a fresh grace for a picture taken off again', async () => {
    const p = plan();
    p.card('a', { attachments: [pic('one')] });
    p.edit('a', {});
    await p.stamp(1_000);
    expect(p.noted()).toEqual([{ id: 'one', due: 1_000 + IMAGE_RELEASE_GRACE_MS }]);
    p.edit('a', { attachments: [pic('one')] });
    p.edit('a', {});
    expect(p.noted()).toEqual([{ id: 'one', due: null }]);
  });

  it('stays cheap on a busy plan: 2,000 card edits with pictures', () => {
    const p = plan();
    for (let i = 0; i < 50; i++) p.grant(`g${i}`);
    for (let i = 0; i < 200; i++)
      p.card(`c${i}`, { attachments: [pic(`a${i}`), pic(`b${i}`)], photo: `g${i % 50}` });
    const ms = cpuMsOf(() => {
      for (let round = 0; round < 10; round++)
        for (let i = 0; i < 200; i++)
          p.edit(`c${i}`, {
            title: `round ${round}`,
            attachments: [pic(`a${i}`), pic(`b${i}`)],
            photo: `g${i % 50}`,
          });
    });
    expect(p.noted()).toEqual([]);
    expect(ms).toBeLessThan(cpuBudgetMs(1_500));
  });
});

describe('the grace', () => {
  it('starts when the drain stamps it, and is read back as the next release', async () => {
    const p = plan();
    p.card('a', { attachments: [pic('one')] });
    expect(nextImageReleaseAt(nodeItemSql(p.sql))).toBeNull();
    p.edit('a', {});
    expect(nextImageReleaseAt(nodeItemSql(p.sql))).toBeNull();
    await p.stamp(5_000);
    expect(nextImageReleaseAt(nodeItemSql(p.sql))).toBe(5_000 + IMAGE_RELEASE_GRACE_MS);
  });

  it('reads as none on storage without the table', () => {
    expect(
      nextImageReleaseAt({
        exec: () => {
          throw new Error('no such table');
        },
      }),
    ).toBeNull();
  });
});

describe('a release', () => {
  async function removed(p: ReturnType<typeof plan>, id: string, fields: Record<string, unknown>) {
    p.card(`holder-${id}`, fields);
    p.edit(`holder-${id}`, {});
    await p.stamp(0);
  }
  const DUE = IMAGE_RELEASE_GRACE_MS;

  it('asks the service once the grace is over, and not before', async () => {
    const p = plan();
    await removed(p, 'one', { attachments: [pic('one')] });
    expect(await releaseDueImages(p.env, PLAN, DUE - 1)).toEqual({
      released: 0,
      kept: 0,
      held: 0,
      retried: 0,
    });
    expect(released).toEqual([]);
    expect((await releaseDueImages(p.env, PLAN, DUE)).released).toBe(1);
    expect(released).toEqual([`one@${PLAN}`]);
    expect(p.noted()).toEqual([]);
  });

  it('keeps a picture another card holds, a trashed card too, without asking', async () => {
    const p = plan();
    p.card('other', { attachments: [pic('shared')] });
    p.card('trashed', { status: 'trash', trashedFrom: 'todo', attachments: [pic('binned')] });
    await removed(p, 'shared', { attachments: [pic('shared')] });
    await removed(p, 'binned', { attachments: [pic('binned')] });
    expect(await releaseDueImages(p.env, PLAN, DUE)).toMatchObject({ held: 2, released: 0 });
    expect(released).toEqual([]);
    expect(p.noted()).toEqual([]);
  });

  it('keeps a picture an undo put back within the grace', async () => {
    const p = plan();
    p.card('a', { attachments: [pic('one')] });
    p.edit('a', {});
    await p.stamp(0);
    // Undo: the card holds it again.
    p.edit('a', { attachments: [pic('one')] });
    expect((await releaseDueImages(p.env, PLAN, DUE)).held).toBe(1);
    expect(released).toEqual([]);
  });

  it('keeps a picture a tab, an agent’s changeset or a snapshot still names', async () => {
    const p = plan();
    await removed(p, 'in-tab', { attachments: [pic('in-tab')] });
    await removed(p, 'in-changeset', { attachments: [pic('in-changeset')] });
    await removed(p, 'in-snapshot', { attachments: [pic('in-snapshot')] });
    p.sql
      .prepare("INSERT INTO tabs (id, name, data, rev, updated_at) VALUES ('t', 'Tab', ?, 1, 1)")
      .run(JSON.stringify({ elements: [{ image: 'in-tab' }] }));
    p.sql
      .exec(`INSERT INTO agent_changesets (id, plan_id, tab_id, rev, author_id, author_name, author_color,
      fingerprints, added, changed, removed, created_at) VALUES ('c', '${PLAN}', 't', 1, 'u', 'U', '#000', '[]', 0, 0, 0, 1)`);
    p.sql
      .prepare(
        "INSERT INTO agent_changeset_parts (changeset_id, part, data) VALUES ('c', 'inverse', ?)",
      )
      .run('{"attachments":[{"id":"in-changeset"}]}');
    // A snapshot whose body cuts the id across two chunks.
    p.sql.exec(`CREATE TABLE snapshot_chunks (snapshot_id TEXT, seq INTEGER, data TEXT)`);
    p.sql
      .prepare('INSERT INTO snapshot_chunks (snapshot_id, seq, data) VALUES (?, ?, ?)')
      .run('s', 0, '{"cards":[{"attachments":[{"id":"in-snap');
    p.sql
      .prepare('INSERT INTO snapshot_chunks (snapshot_id, seq, data) VALUES (?, ?, ?)')
      .run('s', 1, 'shot"}]}]}');
    expect((await releaseDueImages(p.env, PLAN, DUE)).held).toBe(3);
    expect(released).toEqual([]);
    expect(await planStillHolds(p.env, PLAN, 'nowhere')).toBe(false);
  });

  it('ends the row when the service keeps the picture', async () => {
    const p = plan();
    answer = 'kept';
    await removed(p, 'one', { attachments: [pic('one')] });
    expect((await releaseDueImages(p.env, PLAN, DUE)).kept).toBe(1);
    expect(p.noted()).toEqual([]);
  });

  it('tries a failed release again later, doubling, and gives up after its last try', async () => {
    const p = plan();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    answer = 'fail';
    await removed(p, 'one', { attachments: [pic('one')] });
    expect((await releaseDueImages(p.env, PLAN, DUE)).retried).toBe(1);
    expect(p.noted()).toEqual([{ id: 'one', due: DUE + IMAGE_RELEASE_RETRY_MS }]);
    expect((await releaseDueImages(p.env, PLAN, DUE + IMAGE_RELEASE_RETRY_MS)).retried).toBe(1);
    expect(p.noted()).toEqual([
      { id: 'one', due: DUE + IMAGE_RELEASE_RETRY_MS + 2 * IMAGE_RELEASE_RETRY_MS },
    ]);
    p.sql.exec(`UPDATE image_releases SET attempts = ${IMAGE_RELEASE_ATTEMPTS_MAX - 1}`);
    await releaseDueImages(p.env, PLAN, DUE * 10);
    expect(p.noted()).toEqual([]);
    expect(warn).toHaveBeenCalledWith('[media] release given up', {
      planId: PLAN,
      attempts: IMAGE_RELEASE_ATTEMPTS_MAX,
    });
  });

  it('drops the rows without the media service, asking nobody', async () => {
    const p = plan({});
    await removed(p, 'one', { attachments: [pic('one')] });
    await releaseDueImages(p.env, PLAN, DUE);
    expect(released).toEqual([]);
    expect(p.noted()).toEqual([]);
  });

  it('asks at most a wake’s worth at a time', async () => {
    const p = plan();
    const many = Array.from({ length: IMAGE_RELEASES_PER_WAKE + 3 }, (_, i) => pic(`p${i}`));
    p.card('a', { attachments: many });
    p.edit('a', {});
    await p.stamp(0);
    await releaseDueImages(p.env, PLAN, DUE);
    expect(released).toHaveLength(IMAGE_RELEASES_PER_WAKE);
    expect(p.noted()).toHaveLength(3);
  });
});

describe('a picture put back while its release is asked', () => {
  // The room's doors as blockConcurrencyWhile keeps them: a request arriving while they are shut waits until the
  // work settles, then runs.
  function doors() {
    let shut = false;
    const waiting: (() => void)[] = [];
    const hold = async <T>(work: () => Promise<T>): Promise<T> => {
      shut = true;
      try {
        return await work();
      } finally {
        shut = false;
        for (const request of waiting.splice(0)) request();
      }
    };
    const arrive = (request: () => void) => (shut ? waiting.push(request) : request());
    return { hold, arrive };
  }

  async function removedOne(p: ReturnType<typeof plan>) {
    p.card('a', { attachments: [pic('one')] });
    p.edit('a', {});
    await p.stamp(0);
  }

  it('waits at the shut doors, so the service never deletes a picture a card holds', async () => {
    const p = plan();
    await removedOne(p);
    const { hold, arrive } = doors();
    let heldWhenAsked: boolean | null = null;
    duringRelease = () => {
      arrive(() => p.edit('a', { attachments: [pic('one')] }));
      heldWhenAsked =
        p.sql.prepare("SELECT instr(fields, 'one') > 0 AS held FROM items WHERE id = 'a'").get()!
          .held === 1;
    };
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await releaseDueImages(p.env, PLAN, IMAGE_RELEASE_GRACE_MS, hold)).released).toBe(1);
    // The service answered while no card held it; the re-add landed only after the answer.
    expect(heldWhenAsked).toBe(false);
    expect(await planStillHolds(p.env, PLAN, 'one')).toBe(true);
    expect(error).not.toHaveBeenCalled();
  });

  it('says so loudly when a picture is back after a release, as it could be with the doors open', async () => {
    const p = plan();
    await removedOne(p);
    duringRelease = () => p.edit('a', { attachments: [pic('one')] });
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    await releaseDueImages(p.env, PLAN, IMAGE_RELEASE_GRACE_MS);
    expect(error).toHaveBeenCalledWith('[media] released a picture the plan holds again', {
      planId: PLAN,
    });
  });

  it('opens the doors again when the service is slow, and tries later', async () => {
    vi.useFakeTimers();
    const p = plan();
    await removedOne(p);
    answer = 'silent';
    const { hold } = doors();
    const run = releaseDueImages(p.env, PLAN, IMAGE_RELEASE_GRACE_MS, hold);
    await vi.advanceTimersByTimeAsync(IMAGE_RELEASE_TIMEOUT_MS);
    expect(await run).toMatchObject({ released: 0, retried: 1 });
    expect(p.noted()).toEqual([
      { id: 'one', due: IMAGE_RELEASE_GRACE_MS + IMAGE_RELEASE_RETRY_MS },
    ]);
  });

  it('asks nothing more in a wake once the service is slow, so the doors shut for one timeout at most', async () => {
    vi.useFakeTimers();
    const p = plan();
    p.card('a', { attachments: [pic('one'), pic('two')] });
    p.edit('a', {});
    await p.stamp(0);
    answer = 'silent';
    const run = releaseDueImages(p.env, PLAN, IMAGE_RELEASE_GRACE_MS, doors().hold);
    await vi.advanceTimersByTimeAsync(IMAGE_RELEASE_TIMEOUT_MS);
    expect(await run).toMatchObject({ retried: 1 });
    // The second is still due as it was, for the next wake.
    expect(p.noted()).toEqual([
      { id: 'one', due: IMAGE_RELEASE_GRACE_MS + IMAGE_RELEASE_RETRY_MS },
      { id: 'two', due: IMAGE_RELEASE_GRACE_MS },
    ]);
  });
});

describe('in the room', () => {
  it('stamps the grace at the drain, keeps it across a restart, and releases at the alarm', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    const { open } = planNamespace(() => ({ MEDIA_KEY: 'k', MEDIA_URL }) as Env);
    const p = open(PLAN);
    await p.room.grantImage(PLAN, 'photo');
    p.db
      .prepare(
        `INSERT INTO items (plan_id, id, type, item_key, rank, fields, rev, created_at, updated_at, created_by, updated_by)
         VALUES (?, 'a', 'task', 1, 'a', ?, 1, 1, 1, '{}', '{}')`,
      )
      .run(PLAN, JSON.stringify({ photo: 'photo' }));
    p.db.prepare("UPDATE items SET fields = '{}' WHERE id = 'a'").run();
    await drainIndex(p.room);
    expect(p.room.releaseAt).toBe(1_000_000 + IMAGE_RELEASE_GRACE_MS);
    const woken = p.restart();
    await vi.advanceTimersByTimeAsync(0);
    expect(woken.releaseAt).toBe(1_000_000 + IMAGE_RELEASE_GRACE_MS);
    vi.setSystemTime(1_000_000 + IMAGE_RELEASE_GRACE_MS);
    const shut = vi.spyOn(woken.state, 'blockConcurrencyWhile');
    await woken.alarm();
    expect(released).toEqual([`photo@${PLAN}`]);
    // The check and the ask ran with the room's doors shut.
    expect(shut).toHaveBeenCalledTimes(1);
    expect(woken.releaseAt).toBeNull();
  });

  it('tries again a minute later when the run fails as a whole', async () => {
    const { open } = planNamespace(() => ({ MEDIA_KEY: 'k', MEDIA_URL }) as Env);
    const p = open(PLAN);
    await p.room.grantImage(PLAN, 'photo');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    p.db.exec('DROP TABLE image_releases');
    p.room.releaseAt = 1;
    const { releaseImages } = await import('./plan-room-content');
    await releaseImages(p.room, 10);
    expect(p.room.releaseAt).toBe(10 + 60_000);
    expect(warn).toHaveBeenCalledWith('[media] releases failed', expect.anything());
  });
});
