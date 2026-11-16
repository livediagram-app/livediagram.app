import { describe, expect, it, vi } from 'vitest';
import { fenceStaleWrite, requestGeneration, stampGeneration } from './fence';
import { SNAPSHOT_MAX_BYTES, SNAPSHOT_NAME_MAX } from './limits';
import {
  answerSnapshotRoute,
  beforeRevertName,
  serveSnapshots,
  snapshotName,
  type SnapshotCaller,
  type SnapshotDoor,
} from './routes';
import {
  advanceGeneration,
  listSnapshots,
  readGeneration,
  readSnapshotText,
  takeSnapshot,
  type SnapshotDb,
} from './store';
import { testDb } from './test/db';
import { SNAPSHOT_FENCED_HEADER, SNAPSHOT_GENERATION_HEADER } from './wire';

const person = { id: 'user_a', name: 'Ada', color: '#f00' };
const editor: SnapshotCaller = { token: false, mayUse: true, person };

// An item whose content is one string, exported and replaced as an app's door does.
function item(initial = 'v1') {
  const state = { content: initial, reverted: [] as number[] };
  const door: SnapshotDoor = {
    exportFile: async () => state.content,
    replaceContent: async (text) => {
      state.content = text;
      return 'ok';
    },
    afterRevert: (g) => state.reverted.push(g),
  };
  return { state, door };
}

function serve(
  db: SnapshotDb,
  door: SnapshotDoor,
  method: string,
  rest: string[] | null,
  opts: {
    caller?: SnapshotCaller;
    body?: unknown;
    headers?: Record<string, string>;
    handle?: () => Promise<Response>;
  } = {},
) {
  const init: RequestInit = { method, headers: opts.headers ?? {} };
  if (opts.body !== undefined)
    init.body = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body);
  return serveSnapshots({
    db,
    itemId: 'p1',
    request: new Request('https://x.test/api/projects/p1/' + (rest ?? []).join('/'), init),
    rest,
    caller: async () => opts.caller ?? editor,
    door: () => door,
    handle: opts.handle ?? (async () => new Response('handled')),
  });
}

describe('serveSnapshots: the routes', () => {
  it('snapshot, edit, revert gives the snapshot back, after a safety snapshot of the edit', async () => {
    const { db } = testDb();
    const { state, door } = item('v1');
    const taken = await serve(db, door, 'POST', ['snapshots'], {
      body: { name: '  Before launch  ' },
    });
    expect(taken.status).toBe(201);
    const { snapshot } = (await taken.json()) as { snapshot: { id: string; name: string } };
    expect(snapshot.name).toBe('Before launch');
    state.content = 'v2';
    const reverted = await serve(db, door, 'POST', ['snapshots', snapshot.id, 'revert'], {
      body: {},
    });
    expect(reverted.status).toBe(200);
    const body = (await reverted.json()) as {
      reverted: { safetySnapshotId: string; generation: number };
    };
    expect(state.content).toBe('v1');
    expect(state.reverted).toEqual([1]);
    expect(body.reverted.generation).toBe(1);
    expect(reverted.headers.get(SNAPSHOT_GENERATION_HEADER)).toBe('1');
    // The edit is kept, so the revert can be undone.
    expect(await readSnapshotText(db, 'p1', body.reverted.safetySnapshotId)).toBe('v2');
    const list = await listSnapshots(db, 'p1');
    expect(list[0]).toMatchObject({
      kind: 'before-revert',
      name: 'Before reverting to "Before launch"',
    });
  });

  it('lists newest first with the cap', async () => {
    const { db } = testDb();
    const { door } = item();
    await serve(db, door, 'POST', ['snapshots'], { body: 'not json' });
    await serve(db, door, 'POST', ['snapshots'], { body: 'null' });
    const res = await serve(db, door, 'GET', ['snapshots']);
    const body = (await res.json()) as { snapshots: { name: string | null }[]; kept: number };
    expect(body.kept).toBe(5);
    expect(body.snapshots).toHaveLength(2);
    expect(body.snapshots[0]!.name).toBeNull();
  });

  it('reverting to the oldest of five still works: it is read before the safety snapshot prunes it', async () => {
    const { db } = testDb();
    const { state, door } = item('v0');
    const ids: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      state.content = `v${i}`;
      const res = await serve(db, door, 'POST', ['snapshots'], { body: { name: `n${i}` } });
      ids.push(((await res.json()) as { snapshot: { id: string } }).snapshot.id);
    }
    state.content = 'now';
    const res = await serve(db, door, 'POST', ['snapshots', ids[0]!, 'revert']);
    expect(res.status).toBe(200);
    expect(state.content).toBe('v0');
    expect(await listSnapshots(db, 'p1')).toHaveLength(5);
  });

  it('deletes one, and 404s a second time', async () => {
    const { db } = testDb();
    const { door } = item();
    const res = await serve(db, door, 'POST', ['snapshots'], { body: {} });
    const { snapshot } = (await res.json()) as { snapshot: { id: string } };
    expect((await serve(db, door, 'DELETE', ['snapshots', snapshot.id])).status).toBe(204);
    expect((await serve(db, door, 'DELETE', ['snapshots', snapshot.id])).status).toBe(404);
  });

  it('refuses a token before anything, and anyone else who may not use them as missing', async () => {
    const { db } = testDb();
    const { door } = item();
    const exportFile = vi.spyOn(door, 'exportFile');
    const token = await serve(db, door, 'POST', ['snapshots'], {
      caller: { token: true, mayUse: true, person },
    });
    expect(token.status).toBe(403);
    expect(((await token.json()) as { error: string }).error).toBe('snapshots_need_a_person');
    for (const method of ['GET', 'POST']) {
      const viewer = await serve(db, door, method, ['snapshots'], {
        caller: { token: false, mayUse: false, person },
      });
      expect(viewer.status).toBe(404);
    }
    expect(exportFile).not.toHaveBeenCalled();
  });

  it('answers unknown shapes and wrong methods', async () => {
    const { db } = testDb();
    const { door } = item();
    expect((await serve(db, door, 'PUT', ['snapshots'])).status).toBe(405);
    expect((await serve(db, door, 'GET', ['snapshots', 's_x'])).status).toBe(405);
    expect((await serve(db, door, 'GET', ['snapshots', 's_x', 'revert'])).status).toBe(405);
    expect((await serve(db, door, 'POST', ['snapshots', 's_x', 'other'])).status).toBe(404);
    expect((await serve(db, door, 'POST', ['snapshots', 's_x', 'revert'])).status).toBe(404);
  });

  it('a take of an item never started is missing; one too large is refused', async () => {
    const { db } = testDb();
    const none: SnapshotDoor = { exportFile: async () => null, replaceContent: async () => 'ok' };
    expect((await serve(db, none, 'POST', ['snapshots'])).status).toBe(404);
    const huge: SnapshotDoor = {
      exportFile: async () => 'x'.repeat(SNAPSHOT_MAX_BYTES + 1),
      replaceContent: async () => 'ok',
    };
    expect((await serve(db, huge, 'POST', ['snapshots'])).status).toBe(413);
  });

  it('never skips the safety snapshot: a revert it cannot take changes nothing', async () => {
    const { db } = testDb();
    const replaceContent = vi.fn(async () => 'ok' as const);
    await takeSnapshot(db, {
      itemId: 'p1',
      text: 'old',
      name: null,
      kind: 'manual',
      author: person,
    });
    const [target] = await listSnapshots(db, 'p1');
    const huge: SnapshotDoor = {
      exportFile: async () => 'x'.repeat(SNAPSHOT_MAX_BYTES + 1),
      replaceContent,
    };
    expect((await serve(db, huge, 'POST', ['snapshots', target!.id, 'revert'])).status).toBe(413);
    expect(replaceContent).not.toHaveBeenCalled();
    expect(await readGeneration(db, 'p1')).toBe(0);
    const gone: SnapshotDoor = { exportFile: async () => null, replaceContent };
    expect((await serve(db, gone, 'POST', ['snapshots', target!.id, 'revert'])).status).toBe(404);
  });

  it('an unreadable snapshot, or one the door cannot read, is refused', async () => {
    const { db, sql } = testDb();
    await takeSnapshot(db, {
      itemId: 'p1',
      text: 'old',
      name: null,
      kind: 'manual',
      author: person,
    });
    const [target] = await listSnapshots(db, 'p1');
    const { door } = item();
    sql.exec('DELETE FROM snapshot_chunks');
    expect((await serve(db, door, 'POST', ['snapshots', target!.id, 'revert'])).status).toBe(422);
    await takeSnapshot(db, {
      itemId: 'p1',
      text: 'old',
      name: null,
      kind: 'manual',
      author: person,
      now: Date.now() + 5,
    });
    const [readable] = await listSnapshots(db, 'p1');
    for (const [answer, status] of [
      ['invalid', 422],
      ['too_large', 413],
    ] as const) {
      const refusing: SnapshotDoor = {
        exportFile: async () => 'now',
        replaceContent: async () => answer,
      };
      expect(
        (await serve(db, refusing, 'POST', ['snapshots', readable!.id, 'revert'])).status,
      ).toBe(status);
    }
    expect(await readGeneration(db, 'p1')).toBe(0);
  });

  it('a door without afterRevert still reverts', async () => {
    const { db } = testDb();
    await takeSnapshot(db, { itemId: 'p1', text: 'old', name: null, kind: 'manual', author: null });
    const [target] = await listSnapshots(db, 'p1');
    const plain: SnapshotDoor = { exportFile: async () => 'now', replaceContent: async () => 'ok' };
    expect((await serve(db, plain, 'POST', ['snapshots', target!.id, 'revert'])).status).toBe(200);
    expect((await listSnapshots(db, 'p1'))[0]!.name).toBe('Before reverting');
  });
});

describe('serveSnapshots: the fence', () => {
  it('passes a request about no item straight through', async () => {
    const { db } = testDb();
    const res = await serve(db, item().door, 'PUT', null);
    expect(await res.text()).toBe('handled');
  });

  it('refuses a write from before the revert, passes reads, current and unnamed writes, and stamps answers', async () => {
    const { db } = testDb();
    const { door } = item();
    // Before any revert: stamped 0, so the editor names it from then on. A refusal is not stamped.
    const before = await serve(db, door, 'PUT', ['tabs', 't1'], {
      headers: { [SNAPSHOT_GENERATION_HEADER]: '0' },
    });
    expect(before.headers.get(SNAPSHOT_GENERATION_HEADER)).toBe('0');
    const refused = await serve(db, door, 'GET', ['nope'], {
      handle: async () => new Response('missing', { status: 404 }),
    });
    expect(refused.headers.get(SNAPSHOT_GENERATION_HEADER)).toBeNull();
    await takeSnapshot(db, { itemId: 'p1', text: 'old', name: null, kind: 'manual', author: null });
    const [target] = await listSnapshots(db, 'p1');
    await serve(db, door, 'POST', ['snapshots', target!.id, 'revert']);
    const stale = await serve(db, door, 'PUT', ['tabs', 't1'], {
      headers: { [SNAPSHOT_GENERATION_HEADER]: '0' },
    });
    expect(stale.status).toBe(409);
    expect(stale.headers.get(SNAPSHOT_FENCED_HEADER)).toBe('1');
    expect(((await stale.json()) as { error: string }).error).toBe('snapshot_reverted');
    const read = await serve(db, door, 'GET', ['tabs', 't1'], {
      headers: { [SNAPSHOT_GENERATION_HEADER]: '0' },
    });
    expect(read.status).toBe(200);
    expect(read.headers.get(SNAPSHOT_GENERATION_HEADER)).toBe('1');
    const current = await serve(db, door, 'PUT', ['tabs', 't1'], {
      headers: { [SNAPSHOT_GENERATION_HEADER]: '1' },
    });
    expect(current.status).toBe(200);
    const unnamed = await serve(db, door, 'PUT', ['tabs', 't1']);
    expect(unnamed.status).toBe(200);
  });

  it('fenceStaleWrite and requestGeneration read only whole numbers', () => {
    const req = (value: string | null, method = 'POST') =>
      new Request('https://x.test/', {
        method,
        headers: value === null ? {} : { [SNAPSHOT_GENERATION_HEADER]: value },
      });
    expect(requestGeneration(req('abc'))).toBeNull();
    expect(requestGeneration(req('-1'))).toBeNull();
    expect(requestGeneration(req(null))).toBeNull();
    expect(requestGeneration(req('3'))).toBe(3);
    expect(fenceStaleWrite(req('1'), 0)).toBeNull();
    expect(fenceStaleWrite(req('1', 'HEAD'), 3)).toBeNull();
    expect(fenceStaleWrite(req('1', 'delete'), 3)?.status).toBe(409);
  });

  it('stampGeneration leaves an upgrade alone', () => {
    const upgrade = { status: 101 } as Response;
    expect(stampGeneration(upgrade, 2)).toBe(upgrade);
  });
});

describe('answerSnapshotRoute', () => {
  it('answers a request about no item as missing', async () => {
    const { db } = testDb();
    const res = await answerSnapshotRoute({
      db,
      itemId: 'p1',
      request: new Request('https://x.test/', { method: 'GET' }),
      rest: null,
      caller: async () => editor,
      door: () => item().door,
      handle: async () => new Response('x'),
    });
    expect(res.status).toBe(404);
  });
});

describe('the store over a database that answers no rows', () => {
  it('reads empty lists, an unknown generation as 1 after an advance, and a list with no results', async () => {
    const statement = {
      bind: () => statement,
      first: async () => null,
      all: async () => ({}),
      run: async () => ({}),
    };
    const bare = { prepare: () => statement, batch: async () => [], exec: async () => ({}) };
    expect(await listSnapshots(bare, 'p1')).toEqual([]);
    statement.first = (async () => ({ chunks: 0 })) as never;
    expect(await readSnapshotText(bare, 'p1', 's')).toBe('');
    statement.first = async () => null;
    expect(await advanceGeneration(bare, 'p1')).toBe(1);
  });
});

describe('names', () => {
  it('trims, caps by code point and drops empty or non-strings', () => {
    expect(snapshotName('  x  ')).toBe('x');
    expect(snapshotName('   ')).toBeNull();
    expect(snapshotName(4)).toBeNull();
    expect([...snapshotName('😀'.repeat(SNAPSHOT_NAME_MAX + 5))!]).toHaveLength(SNAPSHOT_NAME_MAX);
    expect(beforeRevertName(null)).toBe('Before reverting');
    expect(beforeRevertName('Launch')).toBe('Before reverting to "Launch"');
  });
});
