// Tests only: one document's real room on node:sqlite (the Durable Object's state over @liveworkspace/index-app's
// test state), driven as the worker drives it: `route` with the identity and the index's grant the worker would
// have settled, so a test picks who is calling by role. No accounts, index or email is configured unless a test
// hands one in, so nothing leaves the process. Not a `.test.ts` file, so vitest does not collect it.
import type { Element } from '@livedocuments/document';
import type { AccessLevel } from '@livedocuments/api-schema';
import type { ItemEvent, ItemRule, ItemRuleBody } from '@liveworkspace/automations/item';
import {
  holdRoomState,
  queuedEvents,
  storedRuns,
  testRuleBody,
  testSocket,
  type TestSocket,
} from '@liveworkspace/automations/testing/room-world';
import { nodeDurableState } from '@liveworkspace/index-app/testing';
import type { DatabaseSync } from 'node:sqlite';
import type { DocumentGrant as ItemGrant } from '../../index-service';
import type { Env } from '../../types';
import { DocumentRoom } from '../document-room';
import type { RouteIdentity } from '../document-route';

export const DOC = 'doc-1';
export const ANA = 'user_ana';
export const BEN = 'user_ben';

export const box = (id: string, label = id): Element => ({
  id,
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 120,
  height: 60,
  label,
});

export type Who = {
  // The account or guest id; null for a link visitor with no identity.
  id?: string | null;
  level?: AccessLevel;
  // The one tab a tab-scoped link opens.
  tab?: string | null;
  guest?: boolean;
  token?: { readOnly?: boolean; name?: string };
  // No grant at all.
  stranger?: boolean;
};

/** The caller as the worker would have resolved them, with the index's grant on the document. */
export function identityOf(who: Who = {}, documentId = DOC): RouteIdentity {
  const id = who.id === undefined ? ANA : who.id;
  const account = id !== null && !who.guest;
  const grant: ItemGrant | null = who.stranger
    ? null
    : {
        item: documentId,
        level: who.level ?? 'edit',
        tab: who.tab ?? null,
        sub: id ?? 'link:code',
        team: null,
        owner: ANA,
        exp: Math.floor(Date.now() / 1000) + 600,
        shareCode: who.tab || who.level !== undefined ? 'code' : null,
        token: 'grant',
      };
  return {
    accountUserId: account && !who.token ? id : null,
    verifiedUserId: account ? id : null,
    accountEmail: null,
    owner: id,
    token: who.token
      ? { id: 'tok_1', readOnly: who.token.readOnly === true, name: who.token.name ?? 'Robot' }
      : null,
    workbench: null,
    bearer: null,
    teams: null,
    grant,
  };
}

export type { TestSocket };

export interface RoomWorld {
  room: DocumentRoom;
  // A session in the room, hello said, at this share level.
  connect(level: AccessLevel, name?: string): TestSocket;
  frame(ws: TestSocket, frame: unknown): void;
  db: DatabaseSync;
  env: Env;
  // Work the room deferred (state.waitUntil), settled.
  settled(): Promise<void>;
  send(method: string, path: string, body?: unknown, who?: Who): Promise<Response>;
  // The document, started with its tabs, as its owner's.
  create(tabs?: { id: string; name: string; elements: Element[] }[]): Promise<void>;
  // A whole-tab save by an Editor, at the revision stored.
  saveTab(tabId: string, elements: Element[], name?: string, who?: Who): Promise<Response>;
  rows(query: string, ...bindings: (string | number | null)[]): Record<string, unknown>[];
  queued(): ItemEvent[];
  // A rule saved through the routes as its Editor; answers it as stored.
  rule(body: Partial<ItemRuleBody>, who?: Who): Promise<ItemRule>;
  // The room's alarm, as the runtime would run it.
  alarm(): Promise<void>;
  runs(): Record<string, unknown>[];
}

export function roomWorld(extra: Partial<Env> = {}, documentId = DOC): RoomWorld {
  const { state, db } = nodeDurableState(documentId);
  const { settled } = holdRoomState(state);
  const held: { room?: DocumentRoom } = {};
  const env = {
    // The one document: every call to a room is a call to this one.
    DOCUMENT_ROOM: {
      idFromName: (name: string) => ({ name, equals: (o: { name?: string }) => o?.name === name }),
      get: () => held.room,
    },
    ...extra,
  } as unknown as Env;
  const room = new DocumentRoom(state as unknown as DurableObjectState, env);
  held.room = room;
  const rows: RoomWorld['rows'] = (query, ...bindings) => db.prepare(query).all(...bindings);
  const send: RoomWorld['send'] = (method, path, body, who) =>
    room.route(
      documentId,
      new Request(`https://api.test${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
      identityOf(who, documentId),
    );
  const frame: RoomWorld['frame'] = (ws, value) =>
    room.webSocketMessage(ws as unknown as WebSocket, JSON.stringify(value));
  const w: RoomWorld = {
    room,
    connect: (level, name = 'Ana') => {
      const ws = testSocket();
      room.acceptSession(ws as unknown as WebSocket, level);
      frame(ws, { kind: 'hello', participant: { id: 'x', name, color: '#123456' } });
      return ws;
    },
    frame,
    db,
    env,
    settled,
    send,
    create: async (tabs = [{ id: 't1', name: 'Letter', elements: [box('a')] }]) => {
      const res = await send('POST', '/api/documents', { id: documentId, name: 'Launch', tabs });
      if (res.status !== 201) throw new Error(`create answered ${res.status}: ${await res.text()}`);
    },
    saveTab: async (tabId, elements, name = 'Letter', who) => {
      const stored = rows('SELECT rev FROM tabs WHERE id = ?', tabId)[0];
      return send(
        'PUT',
        `/api/documents/${documentId}/tabs/${tabId}`,
        { id: tabId, name, elements, rev: Number(stored?.['rev'] ?? 0) },
        who,
      );
    },
    rows,
    queued: () => queuedEvents(rows),
    rule: async (body, who) => {
      const res = await send(
        'POST',
        `/api/documents/${documentId}/automations`,
        testRuleBody(body),
        who,
      );
      if (res.status !== 201) throw new Error(`rule answered ${res.status}: ${await res.text()}`);
      return (await res.json<{ rule: ItemRule }>()).rule;
    },
    alarm: () => room.alarm(),
    runs: () => storedRuns(rows),
  };
  return w;
}
