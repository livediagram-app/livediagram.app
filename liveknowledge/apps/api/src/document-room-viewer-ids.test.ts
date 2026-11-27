import { beforeEach, describe, expect, it, vi } from 'vitest';
import { collabKeyFor } from '@liveworkspace/api-kit/collab-key';

// The ids a Viewer sees in the realtime room (docs/specs/013-workspace/share-roles.md "Ids a Viewer sees", Work
// Tracker 1451): every op frame a Viewer's socket receives, live or in a catch-up, names people without their account
// or guest ids, except the Viewer's own; a Participant's, an Editor's and the owner's frames carry every id.

const { store } = vi.hoisted(() => ({
  store: { data: '{"elements":[]}', rev: 0 } as { data: string | null; rev: number },
}));
vi.mock('./db', async (orig) => ({
  ...(await orig<typeof import('./db')>()),
  getTabRow: async () =>
    store.data === null ? null : { data: store.data, rev: store.rev, updatedAt: 0 },
}));

import { DocumentRoom } from './document-room/document-room';
import { replayForSocket } from './document-room/document-room-sockets';

const ALICE = 'user_alice';
const BOB = 'guest_00000000-0000-4000-8000-00000000b0b0';

type Socket = { sent: string[]; attachment: unknown };

function newRoom() {
  const sockets: Socket[] = [];
  const kv = new Map<string, unknown>();
  const cache = new WeakMap<Socket, WebSocket>();
  const wsOf = (s: Socket): WebSocket => {
    let ws = cache.get(s);
    if (!ws) {
      ws = {
        send: (d: string) => void s.sent.push(d),
        serializeAttachment: (v: unknown) => void (s.attachment = v),
        deserializeAttachment: () => s.attachment,
      } as unknown as WebSocket;
      cache.set(s, ws);
    }
    return ws;
  };
  const state = {
    acceptWebSocket: () => {},
    getWebSockets: () => sockets.map(wsOf),
    storage: {
      get: (k: string) => Promise.resolve(kv.get(k)),
      put: (k: string, v: unknown) => Promise.resolve(void kv.set(k, v)),
      delete: (k: string) => Promise.resolve(kv.delete(k)),
      list: () => Promise.resolve(new Map()),
      setAlarm: () => Promise.resolve(),
      deleteAlarm: () => Promise.resolve(),
    },
    blockConcurrencyWhile: (fn: () => Promise<void>) => fn(),
    waitUntil: () => {},
  };
  const room = new DocumentRoom(state as unknown as DurableObjectState, {} as never);
  const join = (
    id: string,
    role: 'view' | 'participate' | 'edit',
    extra: { collabKey?: string; isOwner?: boolean } = {},
  ) => {
    const s: Socket = {
      sent: [],
      attachment: {
        presenceId: id,
        verifiedRole: role,
        presence: { id, key: `key-${id}`, name: id, color: '#abc', role },
        documentId: 'd1',
        ...extra,
      },
    };
    sockets.push(s);
    return s;
  };
  const send = async (from: Socket, msg: unknown) => {
    room.webSocketMessage(wsOf(from), JSON.stringify(msg));
    await new Promise((r) => setTimeout(r, 0));
  };
  return { join, send, room, wsOf };
}

const assigned = {
  id: 'box',
  type: 'shape',
  shape: 'rectangle',
  x: 0,
  y: 0,
  width: 100,
  height: 80,
  label: 'Ship it',
  action: {
    id: 'x1',
    name: 'Ship it',
    description: '',
    assignee: { userId: ALICE, name: 'Alice' },
    teamId: null,
    assignerId: BOB,
    assignerName: 'Bob',
    status: 'open',
    createdAt: 1,
    updatedAt: 1,
  },
};
const update = { kind: 'el', tabId: 't1', op: { kind: 'update', element: assigned } };

const opFrames = (s: Socket) =>
  s.sent.map((f) => JSON.parse(f) as { kind: string }).filter((f) => f.kind === 'op');
const lastAction = (s: Socket) =>
  (opFrames(s).at(-1) as unknown as { op: { op: { element: typeof assigned } } }).op.op.element
    .action;

beforeEach(() => {
  store.data = JSON.stringify({ elements: [{ ...assigned, action: undefined }] });
});

describe('DocumentRoom: the ids a Viewer sees', () => {
  it('hides other people from a Viewer, and hands Participants, Editors and the owner every id', async () => {
    const { join, send } = newRoom();
    const editor = join('E', 'edit', { isOwner: true });
    const viewer = join('V', 'view', { collabKey: 'c'.repeat(32) });
    const participant = join('P', 'participate');
    const otherEditor = join('E2', 'edit');
    await send(editor, { kind: 'op', op: update });
    expect(lastAction(viewer).assignee).toEqual({ userId: 'hidden', name: 'Alice' });
    expect(lastAction(viewer).assignerId).toBe('hidden');
    expect(lastAction(viewer).assignerName).toBe('Bob');
    for (const s of [participant, otherEditor]) {
      expect(lastAction(s).assignee.userId).toBe(ALICE);
      expect(lastAction(s).assignerId).toBe(BOB);
    }
  });

  // For You: the room holds no id, so a Viewer's own is the one whose collab key the session holds.
  it('keeps a signed-in Viewer own id, so For You still finds their action', async () => {
    const { join, send } = newRoom();
    const editor = join('E', 'edit');
    const alice = join('A', 'view', { collabKey: await collabKeyFor(ALICE) });
    await send(editor, { kind: 'op', op: update });
    expect(lastAction(alice).assignee.userId).toBe(ALICE);
    expect(lastAction(alice).assignerId).toBe('hidden');
  });

  it('hides people in a Viewer catch-up too, and leaves an Editor one whole', async () => {
    const { join, send } = newRoom();
    const editor = join('E', 'edit');
    await send(editor, { kind: 'op', op: update });
    const late = join('L', 'view');
    const lateEditor = join('LE', 'edit');
    await send(late, { kind: 'sync', epoch: null, lastSeq: 0 });
    await send(lateEditor, { kind: 'sync', epoch: null, lastSeq: 0 });
    const catchup = (s: Socket) =>
      JSON.stringify(
        s.sent.map((f) => JSON.parse(f) as { kind: string }).find((f) => f.kind === 'catchup'),
      );
    expect(catchup(late)).toContain('Alice');
    expect(catchup(late)).not.toContain(ALICE);
    expect(catchup(late)).not.toContain(BOB);
    expect(catchup(lateEditor)).toContain(ALICE);
  });

  it('passes a frame that names nobody to a Viewer as it was', async () => {
    const { join, send } = newRoom();
    const editor = join('E', 'edit');
    const viewer = join('V', 'view');
    const plain = {
      kind: 'el',
      tabId: 't1',
      op: { kind: 'update', element: { ...assigned, action: undefined } },
    };
    await send(editor, { kind: 'op', op: plain });
    expect(JSON.stringify(opFrames(viewer).at(-1))).toContain('Ship it');
  });

  // A page's people (Work Tracker 1479): its owner, verifier and approval reach a Viewer as stand-ins, live and in a
  // catch-up, and a Participant with their ids. The api tells the room a Page Health change (page-fields-save.ts);
  // a session's own `tab-meta` never carries the knowledge fields.
  it("hands a Viewer a page's people as stand-ins, and a Participant their ids", () => {
    const { join, room, wsOf } = newRoom();
    const viewer = join('V', 'view');
    const participant = join('P', 'participate');
    const knowledge = {
      owner: ALICE,
      verifiedAt: 1,
      verifiedBy: ALICE,
      approval: { state: 'pending', requestedBy: BOB, requestedAt: 1, requestedByName: 'Bob' },
    };
    const op = { kind: 'tab-meta', tabId: 't1', patch: { knowledge } } as const;
    room.broadcast({ kind: 'op', from: 'api', op, seq: 1 });
    const seen = JSON.stringify(opFrames(viewer).at(-1));
    expect(seen).toContain('hidden-p');
    expect(seen).toContain('Bob');
    expect(seen).not.toContain(ALICE);
    expect(seen).not.toContain(BOB);
    expect(JSON.stringify(opFrames(participant).at(-1))).toContain(ALICE);
    const replayed = JSON.stringify(replayForSocket(room, wsOf(viewer), op));
    expect(replayed).toContain('hidden-p');
    expect(replayed).not.toContain(ALICE);
    expect(JSON.stringify(replayForSocket(room, wsOf(participant), op))).toContain(ALICE);
  });
});
