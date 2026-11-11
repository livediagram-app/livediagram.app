import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ATTENDANCE_REJOIN_GRACE_MS } from '@livehuddle/api-schema';
import { collabKeyFor } from '@liveworkspace/api-kit/collab-key';
import { nodeDurableState, nodeItemSql } from '@liveworkspace/index-app/testing';
import { ROOM_MAX_CONNECTIONS } from '@livehuddle/api-schema';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { DocumentRoom } from './document-room';
import { migrateDocumentSchema } from './document-schema';
import { claimedTabs, noteAttendance, sweepStaleAttendance } from './room-attendance';
import type { SessionAttachment } from '../room-session';

// A tab's Attendance through a real room (docs/specs/012-collaboration/tab-attendance.md "One person, one visit"):
// two people's sockets say hello, move between tabs and close, and the room records one visit per person per stretch
// in a tab, whatever their devices and reconnects.

const T0 = 1_800_000_000_000;

type Fake = {
  attachment: unknown;
  send: (data: string) => void;
  serializeAttachment: (value: unknown) => void;
  deserializeAttachment: () => unknown;
  close: () => void;
};

function socket(): Fake {
  const s: Fake = {
    attachment: null,
    send: () => {},
    serializeAttachment: (value) => {
      s.attachment = value;
    },
    deserializeAttachment: () => s.attachment,
    close: () => {},
  };
  return s;
}

let db: DatabaseSync;
let sockets: WebSocket[];
let room: DocumentRoom;

function makeRoom(): DocumentRoom {
  const { state } = nodeDurableState('d1', db);
  const live = state as unknown as {
    acceptWebSocket: (ws: WebSocket) => void;
    getWebSockets: () => WebSocket[];
  };
  live.acceptWebSocket = (ws) => void sockets.push(ws);
  live.getWebSockets = () => [...sockets];
  return new DocumentRoom(state as unknown as DurableObjectState);
}

const rows = () =>
  db
    .prepare('SELECT tab_id, person_key, name, joined_at, left_at FROM tab_attendance ORDER BY id')
    .all() as {
    tab_id: string;
    person_key: string;
    name: string;
    joined_at: number;
    left_at: number | null;
  }[];

async function connect(person: string, opts: { scope?: string; role?: 'edit' | 'view' } = {}) {
  const ws = socket() as unknown as WebSocket;
  const key = await collabKeyFor(person);
  room.acceptSession(
    ws,
    opts.role ?? 'edit',
    false,
    opts.scope ?? null,
    null,
    null,
    null,
    'd1',
    null,
    key,
  );
  return { ws, key };
}

const hello = (ws: WebSocket, name: string, tabId: string) =>
  room.webSocketMessage(
    ws,
    JSON.stringify({ kind: 'hello', participant: { name, color: '#0ea5e9', tabId } }),
  );
const focus = (ws: WebSocket, tabId: string, besideTabId?: string) =>
  room.webSocketMessage(
    ws,
    JSON.stringify({
      kind: 'op',
      op: { kind: 'tab-focus', tabId, ...(besideTabId ? { besideTabId } : {}) },
    }),
  );
function close(ws: WebSocket) {
  sockets = sockets.filter((s) => s !== ws);
  room.webSocketClose(ws);
}
const at = (ms: number) => vi.setSystemTime(T0 + ms);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  at(0);
  db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  const item = nodeItemSql(db);
  migrateDocumentSchema((q) => item.exec(q));
  db.exec(`
    INSERT INTO document (id, saved_at, created_at) VALUES ('d1', 1, 1);
    INSERT INTO tabs (id, name, data, updated_at) VALUES ('t1', 'Lobby', '{"elements":[]}', 1);
    INSERT INTO tabs (id, name, data, updated_at) VALUES ('t2', 'Pod', '{"elements":[]}', 1);
    INSERT INTO document_tabs (document_id, tab_id, order_index, added_at) VALUES ('d1', 't1', 0, 1);
    INSERT INTO document_tabs (document_id, tab_id, order_index, added_at) VALUES ('d1', 't2', 1, 1);
  `);
  sockets = [];
  room = makeRoom();
  room.bindDocument('d1');
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('two people in a Space', () => {
  it('records who joined each tab and when they left', async () => {
    const ada = await connect('guest_ada');
    const bo = await connect('guest_bo');
    hello(ada.ws, 'Ada', 't1');
    at(1_000);
    hello(bo.ws, 'Bo', 't1');
    at(60_000);
    focus(bo.ws, 't2');
    at(600_000);
    close(ada.ws);
    expect(rows()).toEqual([
      { tab_id: 't1', person_key: ada.key, name: 'Ada', joined_at: T0, left_at: T0 + 600_000 },
      { tab_id: 't1', person_key: bo.key, name: 'Bo', joined_at: T0 + 1_000, left_at: T0 + 60_000 },
      { tab_id: 't2', person_key: bo.key, name: 'Bo', joined_at: T0 + 60_000, left_at: null },
    ]);
  });

  it('makes one visit of a person on two devices, ended by the last one leaving', async () => {
    const laptop = await connect('guest_ada');
    const phone = await connect('guest_ada');
    hello(laptop.ws, 'Ada', 't1');
    at(5_000);
    hello(phone.ws, 'Ada', 't1');
    at(10_000);
    close(laptop.ws);
    expect(rows()).toEqual([expect.objectContaining({ joined_at: T0, left_at: null })]);
    at(20_000);
    close(phone.ws);
    expect(rows()).toEqual([expect.objectContaining({ joined_at: T0, left_at: T0 + 20_000 })]);
  });

  it('carries a visit on through a reconnect, and starts another after the grace', async () => {
    const first = await connect('guest_ada');
    hello(first.ws, 'Ada', 't1');
    at(10_000);
    close(first.ws);
    at(15_000);
    const again = await connect('guest_ada');
    hello(again.ws, 'Ada', 't1');
    expect(rows()).toEqual([expect.objectContaining({ joined_at: T0, left_at: null })]);
    close(again.ws);
    at(15_001 + ATTENDANCE_REJOIN_GRACE_MS);
    const later = await connect('guest_ada');
    hello(later.ws, 'Ada', 't1');
    expect(rows()).toHaveLength(2);
  });

  it('counts the other pane of a split as in the tab', async () => {
    const ada = await connect('guest_ada');
    hello(ada.ws, 'Ada', 't1');
    focus(ada.ws, 't1', 't2');
    expect(rows().map((r) => r.tab_id)).toEqual(['t1', 't2']);
    at(1_000);
    focus(ada.ws, 't1');
    expect(rows()[1]!.left_at).toBe(T0 + 1_000);
  });

  it('writes nothing for a repeat hello, a made-up tab or a tab outside a scoped link', async () => {
    const ada = await connect('guest_ada');
    hello(ada.ws, 'Ada', 't1');
    hello(ada.ws, 'Ada', 't1');
    focus(ada.ws, 'not-a-tab');
    const scoped = await connect('guest_bo', { scope: 't2' });
    hello(scoped.ws, 'Bo', 't1');
    expect(rows().map((r) => [r.tab_id, r.name])).toEqual([['t1', 'Ada']]);
    focus(scoped.ws, 't2');
    expect(rows().map((r) => [r.tab_id, r.name])).toEqual([
      ['t1', 'Ada'],
      ['t2', 'Bo'],
    ]);
  });

  it('records a Viewer too: being present is visible to everyone in the Space', async () => {
    const viewer = await connect('guest_vi', { role: 'view' });
    hello(viewer.ws, 'Vi', 't1');
    expect(rows()).toHaveLength(1);
  });

  it('closes twice without harm (an error then a close)', async () => {
    const ada = await connect('guest_ada');
    hello(ada.ws, 'Ada', 't1');
    at(1_000);
    room.webSocketError(ada.ws);
    close(ada.ws);
    expect(rows()).toEqual([expect.objectContaining({ left_at: T0 + 1_000 })]);
  });
});

describe('a full room', () => {
  it('records a move in a room of ROOM_MAX_CONNECTIONS people within a small budget', async () => {
    const people: Awaited<ReturnType<typeof connect>>[] = [];
    for (let i = 0; i < ROOM_MAX_CONNECTIONS; i++) {
      const p = await connect(`guest_${i}`);
      hello(p.ws, `P${i}`, 't1');
      people.push(p);
    }
    // Every person moves to the Pod and back: 200 tab-focus frames, each a pass over 100 sockets.
    const ms = cpuMsOf(() => {
      for (const p of people) focus(p.ws, 't2');
      for (const p of people) focus(p.ws, 't1');
    });
    expect(ms).toBeLessThan(cpuBudgetMs(1_000));
    // Back inside the grace: still one visit each in the Lobby.
    expect(rows().filter((r) => r.tab_id === 't1')).toHaveLength(ROOM_MAX_CONNECTIONS);
  });
});

describe('what the room skips', () => {
  it('stores nothing in a document never started, nor for a session with no key', async () => {
    const bare = new DatabaseSync(':memory:');
    const { state } = nodeDurableState('d2', bare);
    const empty = new DocumentRoom(state as unknown as DurableObjectState);
    const ws = socket() as unknown as WebSocket;
    const session: SessionAttachment = {
      presenceId: 'p',
      presence: { id: 'p', name: 'A', color: '', key: 'k', tabId: 't1' },
    };
    noteAttendance(empty, ws, null, session);
    expect(
      bare.prepare("SELECT name FROM sqlite_master WHERE name = 'tab_attendance'").all(),
    ).toEqual([]);
    noteAttendance(room, ws, null, {
      presenceId: 'p',
      presence: { id: 'p', name: 'A', color: '', tabId: 't1' },
    });
    expect(rows()).toEqual([]);
  });

  it('logs and carries on when the store fails', async () => {
    const ada = await connect('guest_ada');
    db.exec('DROP TABLE tab_attendance');
    // The schema says it is current, so nothing makes the table again: the write throws and is caught.
    expect(() => hello(ada.ws, 'Ada', 't1')).not.toThrow();
    expect(console.warn).toHaveBeenCalledWith('[attendance] not recorded', expect.anything());
  });

  it('reads the tabs a session shows', () => {
    expect(claimedTabs(null)).toEqual([]);
    expect(claimedTabs({ presenceId: 'p', presence: null })).toEqual([]);
    const presence = { id: 'p', name: '', color: '', tabId: 't1', besideTabId: 't1' };
    expect(claimedTabs({ presenceId: 'p', presence })).toEqual(['t1']);
    expect(
      claimedTabs({
        presenceId: 'p',
        presence: { ...presence, besideTabId: 't2' },
        tabScope: 't2',
      }),
    ).toEqual(['t2']);
  });
});

describe('a restart', () => {
  it('closes what a restart left open when the room starts with nobody connected', async () => {
    const ada = await connect('guest_ada');
    hello(ada.ws, 'Ada', 't1');
    // A deploy: the sockets are gone and the room never heard them close.
    sockets = [];
    at(3_600_000);
    room = makeRoom();
    await new Promise((resolve) => setImmediate(resolve));
    expect(rows()[0]!.left_at).toBe(T0);
    // Back inside the grace of the sweep: the same visit carries on.
    at(3_610_000);
    const again = await connect('guest_ada');
    hello(again.ws, 'Ada', 't1');
    expect(rows()).toEqual([expect.objectContaining({ joined_at: T0, left_at: null })]);
  });

  it('sweeps nothing on a wake that still has its sockets', async () => {
    const ada = await connect('guest_ada');
    hello(ada.ws, 'Ada', 't1');
    sweepStaleAttendance(room, T0 + 5);
    expect(rows()[0]!.left_at).toBeNull();
  });

  it('sweeps nothing in a room from before the table', () => {
    db.exec('DROP TABLE tab_attendance');
    sweepStaleAttendance(room, T0);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('logs a sweep that fails', () => {
    db.exec('DROP TABLE tab_attendance');
    db.exec('CREATE TABLE tab_attendance (id INTEGER PRIMARY KEY)');
    sweepStaleAttendance(room, T0);
    expect(console.warn).toHaveBeenCalledWith('[attendance] not swept', expect.anything());
  });
});
