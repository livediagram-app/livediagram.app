// The operator's restore door on workerd (liveworkspace/docs/specs/002-architecture/room-restore.md), the runtime every
// api Worker runs in, through the real door (routes/operator-restore.ts) and a canvas's real room.
//
// What workerd can and cannot show. Local workerd (wrangler dev, unstable_dev, Miniflare) keeps no point-in-time
// recovery: `getBookmarkForTime` and `onNextSessionRestoreBookmark` throw "does not implement point-in-time recovery"
// there, so a room cannot be wound back locally at all. These tests prove, on workerd:
//  - the door answers that honestly (501 `pitr_unavailable`, the runtime's own words) and leaves the room exactly as it
//    was: not restarted, every write still there;
//  - the second half (restoreNow) really restarts the object (a new instance answers) and the door's caller tells that
//    restart apart from a failure, for a canvas's room and a person's store alike;
//  - and, on a runtime that does keep PITR, the whole restore: a write made after the chosen moment is gone, and the
//    undo bookmark brings it back. That case runs only where the dry run finds a bookmark, which local workerd never
//    does, so it is skipped here; the PR's Owner checklist runs the same steps on staging (docs/restore-rooms.md
//    "Checking a Worker's restore").
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { unstable_dev } from 'wrangler';
import {
  askWorker,
  itemDriver,
  startTestWorker,
  type TestWorker,
} from '@liveworkspace/automations/testing/workerd';

const here = (file: string) => fileURLToPath(String(new URL(file, import.meta.url)));

const ANA = 'user_ana';
// wrangler.toml's test value.
const KEY = 'workerd-restore-test-key';

let worker: TestWorker;

beforeAll(async () => {
  worker = await startTestWorker(unstable_dev, {
    worker: here('./worker.ts'),
    config: here('./wrangler.toml'),
    // The port after the automations harness's, so both can run at once on a machine with port blocks.
    port: Number(process.env.WORKERD_TEST_PORT) + 1 || undefined,
  });
}, 120_000);

afterAll(async () => {
  await worker?.stop();
});

const identity = (name: string) => ({
  accountUserId: ANA,
  verifiedUserId: ANA,
  accountEmail: null,
  owner: ANA,
  token: null,
  workbench: null,
  bearer: null,
  teams: null,
  grant: {
    item: name,
    level: 'edit',
    tab: null,
    sub: ANA,
    team: null,
    owner: ANA,
    exp: Math.floor(Date.now() / 1000) + 3600,
    shareCode: null,
    token: 'grant',
  },
});

// One canvas's room: made with one tab, then saved with a labelled box.
async function canvas(name: string) {
  const c = itemDriver({
    worker: () => worker,
    name,
    base: `/api/documents/${name}`,
    identity: identity(name),
  });
  const made = await c.drive('POST', '/api/documents', {
    id: name,
    name: 'Launch',
    tabs: [{ id: `${name}-t1`, name: 'Board', elements: [] }],
  });
  expect(made.status).toBe(201);
  const save = async (label: string) => {
    const [stored] = await c.rows<{ rev: number }>('SELECT rev FROM tabs WHERE id = ?', [
      `${name}-t1`,
    ]);
    const saved = await c.drive('PUT', `${c.base}/tabs/${name}-t1`, {
      id: `${name}-t1`,
      name: 'Board',
      rev: stored?.rev ?? 0,
      elements: [
        { id: 'a', type: 'shape', shape: 'square', x: 0, y: 0, width: 120, height: 60, label },
      ],
    });
    expect(saved.status, JSON.stringify(saved.body)).toBe(200);
  };
  const label = async () => {
    const [row] = await c.rows<{ data: string }>('SELECT data FROM tabs WHERE id = ?', [
      `${name}-t1`,
    ]);
    return (JSON.parse(row!.data) as { elements: { label?: string }[] }).elements[0]?.label ?? null;
  };
  return { ...c, save, label };
}

async function restore(body: Record<string, unknown>) {
  const res = await worker.fetch('/api/internal/restore', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as { rooms?: Record<string, unknown>[] } };
}

const instance = async (which: string, name: string) =>
  (await askWorker<{ instance: string }>(worker, '/instance', { class: which, name })).instance;

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Whether this runtime keeps PITR: a dry run finds a bookmark (200) where it does, 501 where it does not.
async function keepsPitr(name: string): Promise<boolean> {
  const { status } = await restore({
    class: 'DocumentRoom',
    name,
    at: Date.now() - 1000,
    dryRun: true,
  });
  return status === 200;
}

describe('where the runtime keeps no PITR (local workerd)', () => {
  it('answers 501 pitr_unavailable in the runtime’s words, and the room keeps every write, unrestarted', async () => {
    const c = await canvas('restore-local');
    await c.save('before');
    await pause(20);
    const moment = Date.now();
    await pause(20);
    await c.save('after');
    const was = await instance('DocumentRoom', c.name);
    if (await keepsPitr(c.name)) return; // A runtime with PITR: the case below covers it.

    for (const dryRun of [true, false]) {
      const res = await restore({ class: 'DocumentRoom', name: c.name, at: moment, dryRun });
      expect(res.status).toBe(501);
      expect(res.body.rooms).toEqual([
        {
          name: c.name,
          ok: false,
          error: 'pitr_unavailable',
          message: expect.stringContaining('does not implement point-in-time recovery'),
        },
      ]);
    }
    expect(await c.label()).toBe('after');
    expect(await instance('DocumentRoom', c.name)).toBe(was);
  });

  it('refuses the wrong key on workerd as anywhere', async () => {
    const res = await worker.fetch('/api/internal/restore', {
      method: 'POST',
      headers: { Authorization: 'Bearer not-the-key' },
      body: JSON.stringify({ class: 'DocumentRoom', name: 'x', at: Date.now() - 1000 }),
    });
    expect(res.status).toBe(401);
  });
});

describe('the restart (restoreNow)', () => {
  it("restarts a canvas's room: a new instance answers, its caller sees the restart, storage is kept", async () => {
    const c = await canvas('restore-restart');
    await c.save('kept');
    const was = await instance('DocumentRoom', c.name);
    const res = await askWorker<{ restarted: boolean; message: string }>(worker, '/restart', {
      class: 'DocumentRoom',
      name: c.name,
    });
    expect(res).toMatchObject({
      restarted: true,
      message: expect.stringContaining('room-restore'),
    });
    expect(await instance('DocumentRoom', c.name)).not.toBe(was);
    // A restart alone winds nothing back: only a bookmark set before it does.
    expect(await c.label()).toBe('kept');
  });

  it("restarts a person's store the same way", async () => {
    const was = await instance('PersonStore', 'user_bo');
    const res = await askWorker<{ restarted: boolean }>(worker, '/restart', {
      class: 'PersonStore',
      name: 'user_bo',
    });
    expect(res.restarted).toBe(true);
    expect(await instance('PersonStore', 'user_bo')).not.toBe(was);
  });
});

describe('where the runtime keeps PITR', () => {
  it('restores a room to a moment before a write, and the write is gone; the undo brings it back', async (ctx) => {
    const c = await canvas('restore-pitr');
    await c.save('before');
    await pause(1500);
    const moment = Date.now();
    await pause(1500);
    await c.save('after');
    if (!(await keepsPitr(c.name))) ctx.skip();

    const res = await restore({ class: 'DocumentRoom', name: c.name, at: moment });
    expect(res.status).toBe(200);
    expect(await c.label()).toBe('before');
    const undo = res.body.rooms![0]!.undo as string;
    expect((await restore({ class: 'DocumentRoom', name: c.name, bookmark: undo })).status).toBe(
      200,
    );
    expect(await c.label()).toBe('after');
  });
});
