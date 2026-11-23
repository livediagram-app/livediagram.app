// The operator's restore door (liveworkspace/docs/specs/002-architecture/room-restore.md): who opens it, what it takes,
// and the order a room is restored in, against rooms that record their calls. The restore on workerd itself is
// test/workerd-restore.
import { describe, expect, it, vi } from 'vitest';
import { SNAPSHOT_REVERTED_CLOSE } from '@liveworkspace/api-schema/room-wire';
import {
  handleRoomRestore,
  isRoomRestart,
  PITR_WINDOW_MS,
  prepareRoomRestore,
  RESTORE_BATCH_MAX,
  RESTORE_BODY_MAX_BYTES,
  RESTORE_CONCURRENCY,
  restartRoom,
  ROOM_NAME_MAX,
  ROOM_RESTORE_REASON,
  ROOM_RESTORED_REASON,
  type RestorableRoom,
  type RestoreTarget,
} from './room-restore';

const KEY = 'operator-key-for-tests';
const NOW = Date.UTC(2026, 10, 23, 12);
const HOUR = 60 * 60 * 1000;

// A restart as workerd reports it to the caller.
const restartError = () =>
  Object.assign(new Error(ROOM_RESTORE_REASON), { durableObjectReset: true });

// A room that records each call, in order, across every room of a test.
function world(
  behave: {
    prepare?: (name: string) => Promise<unknown> | undefined;
    now?: (name: string) => unknown;
  } = {},
) {
  const calls: string[] = [];
  let inFlight = 0;
  let peak = 0;
  const room = (name: string): RestorableRoom => ({
    restorePrepare: async (target: RestoreTarget, dryRun: boolean) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      calls.push(`prepare ${name} ${JSON.stringify(target)} ${dryRun}`);
      await new Promise((r) => setTimeout(r, 1));
      inFlight -= 1;
      const failed = behave.prepare?.(name);
      if (failed) await failed;
      return { bookmark: `b-${name}`, undo: dryRun ? null : `u-${name}` };
    },
    restoreNow: () => {
      calls.push(`now ${name}`);
      const thrown = behave.now ? behave.now(name) : restartError();
      if (thrown) throw thrown as Error;
    },
  });
  return { calls, room, peak: () => peak };
}

function call(
  body: unknown,
  opts: {
    key?: string | undefined;
    bearer?: string | null;
    method?: string;
    raw?: string;
    rooms?: Record<string, (name: string) => RestorableRoom>;
  } = {},
) {
  const w = world();
  const logs: [string, Record<string, unknown>][] = [];
  const headers: Record<string, string> = {};
  const bearer = opts.bearer === undefined ? KEY : opts.bearer;
  if (bearer !== null) headers.Authorization = `Bearer ${bearer}`;
  const method = opts.method ?? 'POST';
  const request = new Request('https://api.test/api/internal/restore', {
    method,
    headers,
    body:
      method === 'GET'
        ? undefined
        : (opts.raw ?? (body === undefined ? undefined : JSON.stringify(body))),
  });
  const done = handleRoomRestore(request, {
    key: 'key' in opts ? opts.key : KEY,
    app: 'testapp',
    rooms: opts.rooms ?? { DocumentRoom: w.room, PersonStore: w.room },
    now: () => NOW,
    log: (message, fields) => void logs.push([message, fields]),
  });
  return { done, calls: w.calls, logs };
}

const read = async (res: Response) => ({
  status: res.status,
  body: await res.json<Record<string, unknown>>(),
});

describe('who opens the door', () => {
  it('answers 404 to everyone when no OPERATOR_KEY is set, the right key or not', async () => {
    for (const key of [undefined, '']) {
      const { done, calls } = call({ class: 'DocumentRoom', name: 'd1', at: NOW - HOUR }, { key });
      expect((await read(await done)).status).toBe(404);
      expect(calls).toEqual([]);
    }
  });

  it('refuses a missing Bearer, a wrong key and any other credential with 401, and logs it without the key', async () => {
    for (const bearer of [
      null,
      'wrong',
      `${KEY}x`,
      'lwt_an_api_token',
      'eyJhbGciOi.account.token',
      '',
    ]) {
      const { done, calls, logs } = call(
        { class: 'DocumentRoom', name: 'd1', at: NOW - HOUR },
        { bearer },
      );
      expect(await read(await done)).toEqual({ status: 401, body: { error: 'unauthorized' } });
      expect(calls).toEqual([]);
      expect(logs).toEqual([['[room-restore] refused', { app: 'testapp', bearer: !!bearer }]]);
      expect(JSON.stringify(logs)).not.toContain(KEY);
    }
  });

  it('refuses a key sent another way than as a Bearer', async () => {
    const request = new Request('https://api.test/api/internal/restore', {
      method: 'POST',
      headers: { Authorization: KEY },
      body: '{}',
    });
    const res = await handleRoomRestore(request, { key: KEY, app: 'a', rooms: {}, log: () => {} });
    expect(res.status).toBe(401);
  });

  it('takes only POST, once the key is good', async () => {
    const { done } = call(undefined, { method: 'GET' });
    expect((await read(await done)).status).toBe(405);
  });

  it('logs to the console when no log is given', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const res = await handleRoomRestore(new Request('https://api.test/x', { method: 'POST' }), {
      key: KEY,
      app: 'a',
      rooms: {},
    });
    expect(res.status).toBe(401);
    expect(warn).toHaveBeenCalledWith('[room-restore] refused', '{"app":"a","bearer":false}');
    warn.mockRestore();
  });
});

describe('what it takes', () => {
  const refused = async (body: unknown, error: string, raw?: string) => {
    const { done, calls } = call(body, { raw });
    expect(await read(await done)).toEqual({ status: 400, body: { error } });
    expect(calls).toEqual([]);
  };

  it('refuses a body that is not a JSON object', async () => {
    await refused(undefined, 'invalid_body');
    await refused(undefined, 'invalid_body', '{not json');
    await refused(undefined, 'invalid_body', '[]');
    await refused(undefined, 'invalid_body', 'null');
  });

  it('refuses a body over the cap with 413, unread past it', async () => {
    const { done } = call(undefined, { raw: 'x'.repeat(RESTORE_BODY_MAX_BYTES + 1) });
    expect((await read(await done)).status).toBe(413);
  });

  it("refuses a class that is not one of the Worker's", async () => {
    await refused({ name: 'd1', at: NOW - HOUR }, 'unknown_class');
    await refused({ class: 'PlanRoom', name: 'd1', at: NOW - HOUR }, 'unknown_class');
    await refused({ class: 'toString', name: 'd1', at: NOW - HOUR }, 'unknown_class');
  });

  it('takes name or names, never both or neither', async () => {
    await refused({ class: 'DocumentRoom', at: NOW - HOUR }, 'name_or_names');
    await refused(
      { class: 'DocumentRoom', name: 'a', names: ['b'], at: NOW - HOUR },
      'name_or_names',
    );
    await refused({ class: 'DocumentRoom', name: '', at: NOW - HOUR }, 'invalid_name');
    await refused({ class: 'DocumentRoom', name: 7, at: NOW - HOUR }, 'invalid_name');
    await refused(
      { class: 'DocumentRoom', name: 'x'.repeat(ROOM_NAME_MAX + 1), at: NOW - HOUR },
      'invalid_name',
    );
    await refused({ class: 'DocumentRoom', names: [], at: NOW - HOUR }, 'invalid_names');
    await refused({ class: 'DocumentRoom', names: 'd1', at: NOW - HOUR }, 'invalid_names');
    await refused({ class: 'DocumentRoom', names: ['a', ''], at: NOW - HOUR }, 'invalid_name');
  });

  it('refuses more than 20 rooms in one call, never cutting the list short', async () => {
    const names = Array.from({ length: RESTORE_BATCH_MAX + 1 }, (_, i) => `d${i}`);
    await refused({ class: 'DocumentRoom', names, at: NOW - HOUR }, 'too_many_rooms');
  });

  it('takes at or bookmark, never both or neither', async () => {
    await refused({ class: 'DocumentRoom', name: 'd1' }, 'at_or_bookmark');
    await refused(
      { class: 'DocumentRoom', name: 'd1', at: NOW - HOUR, bookmark: 'ab' },
      'at_or_bookmark',
    );
  });

  it('refuses a moment that is not a time, in the future or past the 30 days', async () => {
    await refused({ class: 'DocumentRoom', name: 'd1', at: 'yesterday-ish' }, 'invalid_at');
    await refused({ class: 'DocumentRoom', name: 'd1', at: true }, 'invalid_at');
    await refused({ class: 'DocumentRoom', name: 'd1', at: NOW + 1 }, 'at_in_future');
    await refused(
      { class: 'DocumentRoom', name: 'd1', at: NOW - PITR_WINDOW_MS - 1 },
      'at_too_old',
    );
  });

  it('refuses a bookmark that is not dash-separated hex', async () => {
    await refused({ class: 'DocumentRoom', name: 'd1', bookmark: '' }, 'invalid_bookmark');
    await refused({ class: 'DocumentRoom', name: 'd1', bookmark: 'zz' }, 'invalid_bookmark');
    await refused({ class: 'DocumentRoom', name: 'd1', bookmark: 9 }, 'invalid_bookmark');
    await refused(
      { class: 'DocumentRoom', name: 'd1', bookmark: 'a'.repeat(129) },
      'invalid_bookmark',
    );
  });

  it('refuses a dryRun that is not true or false', async () => {
    await refused(
      { class: 'DocumentRoom', name: 'd1', at: NOW - HOUR, dryRun: 'yes' },
      'invalid_dry_run',
    );
  });

  it('checks a long bookmark in linear time', async () => {
    // The bookmark check walks characters, no pattern: the cap bounds it, and a 1 MB one is refused by the body cap.
    const { done } = call({ class: 'DocumentRoom', name: 'd1', bookmark: `${'a-'.repeat(63)}g` });
    expect((await read(await done)).body).toEqual({ error: 'invalid_bookmark' });
  });
});

describe('a restore', () => {
  it('restores one room to a moment: prepare, then restart, answering the bookmark and the undo', async () => {
    const at = NOW - HOUR;
    const { done, calls, logs } = call({ class: 'DocumentRoom', name: 'd1', at });
    expect(await read(await done)).toEqual({
      status: 200,
      body: {
        app: 'testapp',
        class: 'DocumentRoom',
        dryRun: false,
        rooms: [{ name: 'd1', ok: true, bookmark: 'b-d1', undo: 'u-d1' }],
      },
    });
    expect(calls).toEqual([`prepare d1 {"at":${at}} false`, 'now d1']);
    expect(logs).toEqual([
      [
        '[room-restore]',
        {
          app: 'testapp',
          class: 'DocumentRoom',
          name: 'd1',
          at,
          dryRun: false,
          bookmark: 'b-d1',
          undo: 'u-d1',
        },
      ],
    ]);
  });

  it('takes an ISO 8601 moment', async () => {
    const at = new Date(NOW - 2 * HOUR).toISOString();
    const { done, calls } = call({ class: 'PersonStore', name: 'user_ada', at });
    expect((await read(await done)).status).toBe(200);
    expect(calls[0]).toBe(`prepare user_ada {"at":${NOW - 2 * HOUR}} false`);
  });

  it("judges the moment against the Worker's clock when no clock is given", async () => {
    const w = world();
    const res = await handleRoomRestore(
      new Request('https://api.test/api/internal/restore', {
        method: 'POST',
        headers: { Authorization: `Bearer ${KEY}` },
        body: JSON.stringify({ class: 'DocumentRoom', name: 'd1', at: Date.now() - HOUR }),
      }),
      { key: KEY, app: 'a', rooms: { DocumentRoom: w.room }, log: () => {} },
    );
    expect(res.status).toBe(200);
  });

  it('undoes a restore by the bookmark it answered', async () => {
    const { done, calls } = call({
      class: 'DocumentRoom',
      name: 'd1',
      bookmark: '0000abcd-0000-FFFF-12',
    });
    expect((await read(await done)).status).toBe(200);
    expect(calls).toEqual(['prepare d1 {"bookmark":"0000abcd-0000-FFFF-12"} false', 'now d1']);
  });

  it('changes nothing on a dry run: no restart, no undo', async () => {
    const { done, calls } = call({
      class: 'DocumentRoom',
      name: 'd1',
      at: NOW - HOUR,
      dryRun: true,
    });
    const res = await read(await done);
    expect(res.status).toBe(200);
    expect(res.body.rooms).toEqual([{ name: 'd1', ok: true, bookmark: 'b-d1', undo: null }]);
    expect(calls).toEqual([`prepare d1 {"at":${NOW - HOUR}} true`]);
  });

  it('restores up to 20 rooms, four at a time, each answered and logged on its own, a repeated name once', async () => {
    const w = world();
    const names = Array.from({ length: RESTORE_BATCH_MAX - 1 }, (_, i) => `d${i}`);
    const logs: unknown[] = [];
    const res = await handleRoomRestore(
      new Request('https://api.test/api/internal/restore', {
        method: 'POST',
        headers: { Authorization: `Bearer ${KEY}` },
        body: JSON.stringify({ class: 'DocumentRoom', names: [...names, 'd0'], at: NOW - HOUR }),
      }),
      {
        key: KEY,
        app: 'a',
        rooms: { DocumentRoom: w.room },
        now: () => NOW,
        log: (m) => void logs.push(m),
      },
    );
    const body = await res.json<{ rooms: { name: string }[] }>();
    expect(res.status).toBe(200);
    expect(body.rooms.map((r) => r.name)).toEqual(names);
    expect(w.calls.filter((c) => c.startsWith('now'))).toHaveLength(names.length);
    expect(w.peak()).toBe(RESTORE_CONCURRENCY);
    expect(logs).toHaveLength(names.length);
  });

  it('answers 501 pitr_unavailable where the runtime keeps no PITR, and never restarts the room', async () => {
    const w = world({
      prepare: async () => {
        throw new Error(
          "This Durable Object's storage back-end does not implement point-in-time recovery.",
        );
      },
    });
    const res = await handleRoomRestore(
      new Request('https://api.test/api/internal/restore', {
        method: 'POST',
        headers: { Authorization: `Bearer ${KEY}` },
        body: JSON.stringify({ class: 'DocumentRoom', name: 'd1', at: NOW - HOUR }),
      }),
      { key: KEY, app: 'a', rooms: { DocumentRoom: w.room }, now: () => NOW, log: () => {} },
    );
    expect(res.status).toBe(501);
    expect((await res.json<{ rooms: unknown[] }>()).rooms).toEqual([
      {
        name: 'd1',
        ok: false,
        error: 'pitr_unavailable',
        message:
          "Error: This Durable Object's storage back-end does not implement point-in-time recovery.",
      },
    ]);
    expect(w.calls.some((c) => c.startsWith('now'))).toBe(false);
  });

  const failing = async (behave: Parameters<typeof world>[0]) => {
    const w = world(behave);
    const logs: [string, Record<string, unknown>][] = [];
    const res = await handleRoomRestore(
      new Request('https://api.test/api/internal/restore', {
        method: 'POST',
        headers: { Authorization: `Bearer ${KEY}` },
        body: JSON.stringify({ class: 'DocumentRoom', names: ['d1', 'd2'], at: NOW - HOUR }),
      }),
      {
        key: KEY,
        app: 'a',
        rooms: { DocumentRoom: w.room },
        now: () => NOW,
        log: (m, f) => void logs.push([m, f]),
      },
    );
    return {
      status: res.status,
      body: await res.json<{ rooms: Record<string, unknown>[] }>(),
      logs,
    };
  };

  it('answers 502 restore_failed for any other failure, room by room, the rest still restored', async () => {
    const { status, body, logs } = await failing({
      prepare: (name) => (name === 'd1' ? Promise.reject(new Error('boom')) : undefined),
    });
    expect(status).toBe(502);
    expect(body.rooms[0]).toEqual({
      name: 'd1',
      ok: false,
      error: 'restore_failed',
      message: 'Error: boom',
    });
    expect(logs[0]![1]).toMatchObject({
      name: 'd1',
      error: 'restore_failed',
      message: 'Error: boom',
    });
  });

  it('answers restore_failed when the restart fails some other way, and ok when restoreNow returns', async () => {
    const { status, body } = await failing({
      now: (name) => (name === 'd1' ? new Error('socket close threw') : null),
    });
    expect(status).toBe(502);
    expect(body.rooms).toEqual([
      {
        name: 'd1',
        ok: false,
        error: 'restore_failed',
        message: 'restart: Error: socket close threw',
      },
      { name: 'd2', ok: true, bookmark: 'b-d2', undo: 'u-d2' },
    ]);
  });
});

describe("the room's half", () => {
  const storage = () => {
    const calls: string[] = [];
    return {
      calls,
      getBookmarkForTime: async (t: number) => (calls.push(`for ${t}`), 'b-at'),
      onNextSessionRestoreBookmark: async (b: string) => (calls.push(`restore ${b}`), 'b-undo'),
    };
  };

  it('finds the bookmark for a moment and asks to start from it, answering the undo', async () => {
    const s = storage();
    expect(await prepareRoomRestore(s, { at: 5 }, false)).toEqual({
      bookmark: 'b-at',
      undo: 'b-undo',
    });
    expect(s.calls).toEqual(['for 5', 'restore b-at']);
  });

  it('takes a bookmark as given', async () => {
    const s = storage();
    expect(await prepareRoomRestore(s, { bookmark: 'b-given' }, false)).toEqual({
      bookmark: 'b-given',
      undo: 'b-undo',
    });
    expect(s.calls).toEqual(['restore b-given']);
  });

  it('asks nothing of the next start on a dry run', async () => {
    const s = storage();
    expect(await prepareRoomRestore(s, { at: 5 }, true)).toEqual({ bookmark: 'b-at', undo: null });
    expect(s.calls).toEqual(['for 5']);
  });

  it('closes every session with the revert code first, then restarts with the restore reason', () => {
    const order: string[] = [];
    const socket = (id: string, throws = false) =>
      ({
        close: (code: number, reason: string) => {
          order.push(`close ${id} ${code} ${reason}`);
          if (throws) throw new Error('already closed');
        },
      }) as unknown as WebSocket;
    restartRoom({
      getWebSockets: () => [socket('a', true), socket('b')],
      abort: (reason) => void order.push(`abort ${reason}`),
    });
    expect(order).toEqual([
      `close a ${SNAPSHOT_REVERTED_CLOSE} ${ROOM_RESTORED_REASON}`,
      `close b ${SNAPSHOT_REVERTED_CLOSE} ${ROOM_RESTORED_REASON}`,
      `abort ${ROOM_RESTORE_REASON}`,
    ]);
  });

  it('tells the restart apart from a failure', () => {
    expect(isRoomRestart(restartError())).toBe(true);
    expect(isRoomRestart(new Error(`Error: ${ROOM_RESTORE_REASON}`))).toBe(true);
    expect(isRoomRestart(Object.assign(new Error('x'), { durableObjectReset: true }))).toBe(true);
    expect(isRoomRestart(new Error('Network connection lost.'))).toBe(false);
    expect(isRoomRestart(ROOM_RESTORE_REASON)).toBe(false);
  });
});
