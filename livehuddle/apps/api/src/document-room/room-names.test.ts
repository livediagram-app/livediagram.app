import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  guestNameForKey,
  ROOM_MAX_CONNECTIONS,
  type AccessLevel,
  type ParticipantPresence,
} from '@livehuddle/api-schema';
import { collabKeyFor } from '@liveworkspace/api-kit/collab-key';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { nodeDurableState, nodeItemSql } from '@liveworkspace/index-app/testing';
import { readVisitorName, VISITOR_NAMES_MAX, writeVisitorName } from '../db/visitor-names';
import { DocumentRoom } from './document-room';
import { migrateDocumentSchema } from './document-schema';
import { storedVisitorName } from './room-names';
import type { SessionAttachment } from '../room-session';

// Presence names through a real room (docs/specs/014-identity/auth-and-guest-access.md "Presence names"; Work Tracker
// 797 and 801): two or more sockets say hello, rename themselves and reload, and what each peer sees on the roster and
// in Attendance is the room's pick, never a name a client claimed.

const T0 = 1_800_000_000_000;
const SECRET = '0f8e6a2c-1b3d-4e5f-8a9b-0c1d2e3f4a5b';
const OTHER_SECRET = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

type Fake = {
  attachment: unknown;
  sent: string[];
  send: (data: string) => void;
  serializeAttachment: (value: unknown) => void;
  deserializeAttachment: () => unknown;
  close: () => void;
};

function socket(): Fake {
  const s: Fake = {
    attachment: null,
    sent: [],
    send: (data) => void s.sent.push(data),
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

// A person's socket: the api stamped their person tag, collab key and profile name on the upgrade.
async function person(id: string, name: string | null, role: AccessLevel = 'edit') {
  const ws = socket() as unknown as WebSocket;
  room.acceptSession(
    ws,
    role,
    false,
    null,
    null,
    `tag-${id}`,
    null,
    'd1',
    null,
    await collabKeyFor(id),
    null,
    name,
  );
  return ws;
}

// A link visitor's socket: no identity, so no tag, no key and no name from the upgrade.
function visitor(role: AccessLevel = 'edit') {
  const ws = socket() as unknown as WebSocket;
  room.acceptSession(ws, role, false, null, null, null, null, 'd1', null, null);
  return ws;
}

const hello = (ws: WebSocket, name: string, secret?: string) =>
  room.webSocketMessage(
    ws,
    JSON.stringify({
      kind: 'hello',
      participant: { name, color: '#0ea5e9', tabId: 't1' },
      ...(secret ? { visitor: secret } : {}),
    }),
  );
const nameMyself = (ws: WebSocket, name: unknown) =>
  room.webSocketMessage(ws, JSON.stringify({ kind: 'visitor-name', name }));
function close(ws: WebSocket) {
  sockets = sockets.filter((s) => s !== ws);
  room.webSocketClose(ws);
}

const session = (ws: WebSocket) => ws.deserializeAttachment() as SessionAttachment;
// The names on the last roster this socket was sent: everyone else in the room.
function rosterSeenBy(ws: WebSocket): string[] {
  const frames = (ws as unknown as Fake).sent
    .map((f) => JSON.parse(f) as { kind: string; participants?: ParticipantPresence[] })
    .filter((f) => f.kind === 'presence');
  return (frames.at(-1)?.participants ?? []).map((p) => p.name).sort();
}
const attendanceNames = () =>
  (db.prepare('SELECT name FROM tab_attendance ORDER BY id').all() as { name: string }[]).map(
    (r) => r.name,
  );
const renameOverInternal = (personTag: string, name: unknown) =>
  room.fetch(
    new Request('https://room/presence-name', {
      method: 'POST',
      body: JSON.stringify({ personTag, name }),
    }),
  );

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(T0);
  db = new DatabaseSync(':memory:');
  const item = nodeItemSql(db);
  migrateDocumentSchema((q) => item.exec(q));
  db.exec(`
    INSERT INTO document (id, saved_at, created_at) VALUES ('d1', 1, 1);
    INSERT INTO tabs (id, name, data, updated_at) VALUES ('t1', 'Lobby', '{"elements":[]}', 1);
    INSERT INTO document_tabs (document_id, tab_id, order_index, added_at) VALUES ('d1', 't1', 0, 1);
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

describe('a forged hello name (Work Tracker 797)', () => {
  it("never reaches a peer: a person shows as their profile's name, at every share level", async () => {
    const host = await person('user_host', 'Hana Host');
    const editor = await person('guest_ed', 'Ed', 'edit');
    const participant = await person('guest_pa', 'Pat', 'participate');
    const viewer = await person('guest_vi', 'Vi', 'view');
    hello(host, 'Hana Host');
    // Each claims to be the host.
    for (const ws of [editor, participant, viewer]) hello(ws, 'Hana Host');
    expect(rosterSeenBy(host)).toEqual(['Ed', 'Pat', 'Vi']);
    expect(rosterSeenBy(editor)).toEqual(['Hana Host', 'Pat', 'Vi']);
    expect(attendanceNames()).toEqual(['Hana Host', 'Ed', 'Pat', 'Vi']);
  });

  it('gives a person with no profile name their guest name, never the one they claimed', async () => {
    const ws = await person('guest_new', null);
    hello(ws, 'The Host');
    expect(session(ws).presence?.name).toBe(guestNameForKey(await collabKeyFor('guest_new')));
  });
});

describe('a link visitor naming themselves (Work Tracker 797 and 801)', () => {
  it('shows the typed name to peers and in Attendance, and keeps it across a reload', async () => {
    const host = await person('user_host', 'Hana Host');
    hello(host, 'Hana Host');
    const guest = visitor();
    hello(guest, 'Random Fox', SECRET);
    const key = session(guest).presence!.key!;
    // Before they type: their browser's guest name, whatever the hello said.
    expect(rosterSeenBy(host)).toEqual([guestNameForKey(key)]);
    nameMyself(guest, '  Grace  ');
    expect(rosterSeenBy(host)).toEqual(['Grace']);
    expect(attendanceNames()).toEqual(['Hana Host', 'Grace']);
    // A reload: a new socket, the same browser, another random name in its hello.
    close(guest);
    const back = visitor();
    hello(back, 'Swift Otter', SECRET);
    expect(session(back).presence?.name).toBe('Grace');
    expect(rosterSeenBy(host)).toEqual(['Grace']);
    expect(rosterSeenBy(back)).toEqual(['Hana Host']);
  });

  it('keeps one guest name across reloads when they typed nothing, another browser another', () => {
    const first = visitor();
    hello(first, 'Quick Toad', SECRET);
    const name = session(first).presence!.name;
    close(first);
    const again = visitor();
    hello(again, 'Merry Seal', SECRET);
    expect(session(again).presence?.name).toBe(name);
    const stranger = visitor();
    hello(stranger, 'Merry Seal', OTHER_SECRET);
    expect(session(stranger).presence?.name).toBe(
      guestNameForKey(session(stranger).presence!.key!),
    );
  });

  it('lets a Viewer name themselves: their name shows like anyone else', () => {
    const guest = visitor('view');
    hello(guest, 'x', SECRET);
    nameMyself(guest, 'Vera');
    expect(session(guest).presence?.name).toBe('Vera');
  });

  it("refuses a person's visitor-name, a blank, a non-string, and one before the hello", async () => {
    const ada = await person('guest_ada', 'Ada');
    hello(ada, 'Ada');
    nameMyself(ada, 'The Host');
    expect(session(ada).presence?.name).toBe('Ada');
    const guest = visitor();
    nameMyself(guest, 'Early');
    expect(session(guest).presence).toBeNull();
    hello(guest, 'x', SECRET);
    const name = session(guest).presence!.name;
    nameMyself(guest, '   ');
    nameMyself(guest, 42);
    expect(session(guest).presence?.name).toBe(name);
    expect(readVisitorName(nodeItemSql(db), session(guest).presence!.key!)).toBeNull();
  });

  it('sends nobody a roster for the same name again', () => {
    const host = visitor();
    hello(host, 'x', OTHER_SECRET);
    const guest = visitor();
    hello(guest, 'x', SECRET);
    nameMyself(guest, 'Grace');
    const before = (host as unknown as Fake).sent.length;
    nameMyself(guest, 'Grace');
    expect((host as unknown as Fake).sent.length).toBe(before);
  });
});

describe('a person renaming themselves (Work Tracker 801)', () => {
  it('reaches every peer, on every device of theirs, and their open Attendance visit', async () => {
    const laptop = await person('guest_ada', 'Swift Otter');
    const phone = await person('guest_ada', 'Swift Otter');
    const bo = await person('guest_bo', 'Bo');
    hello(laptop, 'Swift Otter');
    hello(phone, 'Swift Otter');
    hello(bo, 'Bo');
    // The join dialog's name, saved to Ada's profile, relayed by the api.
    const res = await renameOverInternal('tag-guest_ada', 'Ada');
    expect(await res.json()).toEqual({ renamed: 2 });
    expect(rosterSeenBy(bo)).toEqual(['Ada', 'Ada']);
    expect(rosterSeenBy(laptop)).toEqual(['Ada', 'Bo']);
    expect(attendanceNames()).toEqual(['Ada', 'Bo']);
    // A later hello on the same socket keeps the new name.
    hello(laptop, 'Swift Otter');
    expect(session(laptop).presence?.name).toBe('Ada');
    expect(session(laptop).verifiedName).toBe('Ada');
  });

  it('renames nobody for an unknown tag or a blank name, and refuses a body with no tag', async () => {
    const ada = await person('guest_ada', 'Ada');
    hello(ada, 'Ada');
    expect(await (await renameOverInternal('tag-nobody', 'X')).json()).toEqual({ renamed: 0 });
    expect(await (await renameOverInternal('tag-guest_ada', '  ')).json()).toEqual({ renamed: 0 });
    expect((await renameOverInternal('', 'X')).status).toBe(400);
    expect(session(ada).presence?.name).toBe('Ada');
  });

  it('skips a socket that is going, and logs visits it could not rename', async () => {
    const going = await person('guest_ada', 'Old');
    hello(going, 'Old');
    const staying = await person('guest_ada', 'Old');
    hello(staying, 'Old');
    (going as unknown as Fake).serializeAttachment = () => {
      throw new Error('closed');
    };
    db.exec('DROP TABLE tab_attendance');
    expect(await (await renameOverInternal('tag-guest_ada', 'Ada')).json()).toEqual({
      renamed: 1,
    });
    expect(session(staying).presence?.name).toBe('Ada');
    expect(console.warn).toHaveBeenCalledWith(
      '[presence-name] visits not renamed',
      expect.anything(),
    );
  });

  it('pins the name on a session that has said no hello yet, for its hello', async () => {
    const ada = await person('guest_ada', 'Old');
    await renameOverInternal('tag-guest_ada', 'Ada');
    hello(ada, 'Old');
    expect(session(ada).presence?.name).toBe('Ada');
  });
});

// A colour change (docs/specs/014-identity/auth-and-guest-access.md "Presence colours"): any session, over its socket.
const recolour = (ws: WebSocket, color: unknown) =>
  room.webSocketMessage(ws, JSON.stringify({ kind: 'presence-colour', color }));
function coloursSeenBy(ws: WebSocket): string[] {
  const frames = (ws as unknown as Fake).sent
    .map((f) => JSON.parse(f) as { kind: string; participants?: ParticipantPresence[] })
    .filter((f) => f.kind === 'presence');
  return (frames.at(-1)?.participants ?? []).map((p) => p.color);
}
const attendanceColours = () =>
  (
    db.prepare('SELECT color FROM tab_attendance WHERE left_at IS NULL ORDER BY id').all() as {
      color: string;
    }[]
  ).map((r) => r.color);

describe('a colour change reaching peers without a reconnect', () => {
  it('shows a new colour to every peer and on the open Attendance visit, at every share level', async () => {
    const host = await person('user_host', 'Hana Host');
    const viewer = await person('guest_vi', 'Vi', 'view');
    const guest = visitor('participate');
    hello(host, 'x');
    hello(viewer, 'x');
    hello(guest, 'x', SECRET);
    recolour(viewer, '#f97316');
    recolour(guest, '#22c55e');
    expect(coloursSeenBy(host).sort()).toEqual(['#22c55e', '#f97316']);
    expect(session(viewer).presence?.color).toBe('#f97316');
    expect(attendanceColours().sort()).toEqual(['#0ea5e9', '#22c55e', '#f97316']);
  });

  it('refuses an unsafe colour, a non-string, one before the hello, and sends nothing for the same colour', async () => {
    const host = await person('user_host', 'Hana Host');
    const peer = await person('guest_pe', 'Pe');
    recolour(peer, '#f97316');
    expect(session(peer).presence).toBeNull();
    hello(host, 'x');
    hello(peer, 'x');
    const before = (host as unknown as Fake).sent.length;
    recolour(peer, 'url(https://evil.example/x.png)');
    recolour(peer, 42);
    recolour(peer, '');
    recolour(peer, '#0ea5e9');
    expect((host as unknown as Fake).sent.length).toBe(before);
    expect(session(peer).presence?.color).toBe('#0ea5e9');
  });

  it('still shows the colour when the visits cannot be recoloured', async () => {
    const host = await person('user_host', 'Hana Host');
    const peer = await person('guest_pe', 'Pe');
    hello(host, 'x');
    hello(peer, 'x');
    db.exec('DROP TABLE tab_attendance');
    recolour(peer, '#f97316');
    expect(coloursSeenBy(host)).toEqual(['#f97316']);
    expect(console.warn).toHaveBeenCalledWith(
      '[presence-colour] visits not recoloured',
      expect.anything(),
    );
  });
});

// The upgrade's X-Verified-Account reaching the session (liveworkspace/docs/specs/003-accounts/accounts.md "Profile
// pictures"): it was read and then dropped before the attachment, so no session was ever an account's.
describe('an account session through the real upgrade', () => {
  const PICTURE = 'https://lh3.googleusercontent.com/a/ada=s96-c';
  async function upgrade(id: string, account: boolean): Promise<WebSocket> {
    const before = sockets.length;
    await room.fetch(
      new Request('https://room/ws', {
        headers: {
          Upgrade: 'websocket',
          'X-Verified-Role': 'edit',
          'X-Verified-Person': `tag-${id}`,
          'X-Verified-Document': 'd1',
          'X-Verified-Collab-Key': await collabKeyFor(id),
          'X-Verified-Name': encodeURIComponent(id),
          'X-Verified-Account': account ? '1' : '0',
        },
      }),
    );
    expect(sockets.length).toBe(before + 1);
    return sockets.at(-1)!;
  }
  const helloWithPicture = (ws: WebSocket) =>
    room.webSocketMessage(
      ws,
      JSON.stringify({
        kind: 'hello',
        participant: { name: 'x', color: '#0ea5e9', tabId: 't1', picture: PICTURE },
      }),
    );

  beforeEach(() => {
    // Node has no WebSocketPair and no 101 Response: the server side is our fake socket, and a 101 reads as a 200.
    vi.stubGlobal(
      'WebSocketPair',
      class {
        0 = socket();
        1 = socket();
      },
    );
    const RealResponse = Response;
    vi.stubGlobal(
      'Response',
      class extends RealResponse {
        constructor(body?: BodyInit | null, init?: ResponseInit) {
          super(body, init?.status === 101 ? { ...init, status: 200 } : init);
        }
      },
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it('keeps an account Google picture for account peers and marks its visit not a guest', async () => {
    const ada = await upgrade('user_ada', true);
    const bo = await upgrade('user_bo', true);
    const guest = await upgrade('guest_cy', false);
    expect(session(ada).account).toBe(true);
    expect(session(guest).account).toBe(false);
    helloWithPicture(ada);
    helloWithPicture(guest);
    hello(bo, 'x');
    const seenByBo = (bo as unknown as Fake).sent
      .map((f) => JSON.parse(f) as { kind: string; participants?: ParticipantPresence[] })
      .filter((f) => f.kind === 'presence')
      .at(-1)!.participants!;
    expect(seenByBo.find((p) => p.name === 'user_ada')?.picture).toBe(PICTURE);
    // A guest's picture is refused, as before.
    expect(seenByBo.find((p) => p.name === 'guest_cy')?.picture).toBeUndefined();
    const visits = db
      .prepare('SELECT name, picture, guest FROM tab_attendance ORDER BY id')
      .all() as { name: string; picture: string | null; guest: number }[];
    expect(visits.find((v) => v.name === 'user_ada')).toMatchObject({ picture: PICTURE, guest: 0 });
    expect(visits.find((v) => v.name === 'guest_cy')).toMatchObject({ picture: null, guest: 1 });
  });
});

describe('a full room', () => {
  it('names ROOM_MAX_CONNECTIONS visitors and renames a person within a small budget', async () => {
    const people: WebSocket[] = [];
    for (let i = 0; i < ROOM_MAX_CONNECTIONS - 1; i++) people.push(visitor());
    const ada = await person('guest_ada', 'Ada');
    const ms = cpuMsOf(() => {
      // Every visitor's hello reads its kept name; each names itself once.
      people.forEach((ws, i) =>
        hello(ws, 'x', `${SECRET.slice(0, -3)}${String(i).padStart(3, '0')}`),
      );
      people.forEach((ws, i) => nameMyself(ws, `Visitor ${i}`));
      hello(ada, 'Ada');
    });
    expect(ms).toBeLessThan(cpuBudgetMs(2_000));
    expect(session(people[42]!).presence?.name).toBe('Visitor 42');
    const renameMs = cpuMsOf(() => void renameOverInternal('tag-guest_ada', 'Ada L'));
    expect(renameMs).toBeLessThan(cpuBudgetMs(200));
  });
});

describe('the visitor names store', () => {
  it('keeps at most VISITOR_NAMES_MAX names, the oldest going first', () => {
    const sql = nodeItemSql(db);
    for (let i = 0; i <= VISITOR_NAMES_MAX; i++) writeVisitorName(sql, `k${i}`, `N${i}`, T0 + i);
    expect(readVisitorName(sql, 'k0')).toBeNull();
    expect(readVisitorName(sql, `k${VISITOR_NAMES_MAX}`)).toBe(`N${VISITOR_NAMES_MAX}`);
    writeVisitorName(sql, 'k1', 'Renamed', T0 + 5_000);
    expect(readVisitorName(sql, 'k1')).toBe('Renamed');
  });

  it('reads no name in a document never started, for a person, or when the store fails', async () => {
    const bare = new DatabaseSync(':memory:');
    const { state } = nodeDurableState('d2', bare);
    const empty = new DocumentRoom(state as unknown as DurableObjectState);
    const anon: SessionAttachment = { presenceId: 'p', presence: null, collabKey: 'k' };
    expect(storedVisitorName(empty, anon)).toBeNull();
    expect(storedVisitorName(room, { ...anon, personTag: 'tag' })).toBeNull();
    expect(storedVisitorName(room, { ...anon, collabKey: undefined })).toBeNull();
    db.exec('DROP TABLE visitor_names');
    expect(storedVisitorName(room, anon)).toBeNull();
    expect(console.warn).toHaveBeenCalledWith(
      '[presence-name] visitor name not read',
      expect.anything(),
    );
    // A typed name with no table still shows; it is only not kept.
    const guest = visitor();
    hello(guest, 'x', SECRET);
    nameMyself(guest, 'Grace');
    expect(session(guest).presence?.name).toBe('Grace');
    expect(console.warn).toHaveBeenCalledWith(
      '[presence-name] visitor name not kept',
      expect.anything(),
    );
  });
});
