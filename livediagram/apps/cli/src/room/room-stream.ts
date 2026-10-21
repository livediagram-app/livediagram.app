// The CLI's listening socket on a document's room (docs/specs/015-api/blueprints/cli.md "The room stream", CLI32):
// a one-time ticket over REST, then a socket that never sends a frame, so it is no session in anyone's roster.
// A dropped socket reconnects with a fresh ticket, backing off from ROOM_RECONNECT_MIN_MS doubling to
// ROOM_RECONNECT_MAX_MS; a document moved to the Trash ends the stream.

import { ApiError, type ApiClient } from '@livediagram/api-client';
import { DOCUMENT_TRASHED_CLOSE } from '@livediagram/api-schema';
import type { CliIo, RoomSocket } from '../io';

export const ROOM_RECONNECT_MIN_MS = 1_000;
export const ROOM_RECONNECT_MAX_MS = 30_000;
const NORMAL_CLOSE = 1000;

export type RoomStreamEnd = 'stopped' | 'trashed';

export type RoomStream = {
  // Closes the socket with 1000 and ends the stream as stopped.
  stop(): void;
  ended: Promise<RoomStreamEnd>;
};

type Deps = {
  io: CliIo;
  api: ApiClient;
  // The api base the token talks to, e.g. https://www.livediagram.app/api.
  apiBase: string;
  documentId: string;
  log: (line: string) => void;
  // A line for the person running the command (stderr).
  notice: (line: string) => void;
  // Each op the room relays, in order.
  onOp: (op: unknown) => void;
  // After a reconnect: what the caller says about the gap.
  onReconnected: () => void;
};

const socketUrl = (apiBase: string, documentId: string, ticket: string) =>
  `${apiBase.replace(/^http/, 'ws')}/documents/${encodeURIComponent(documentId)}/ws?t=${encodeURIComponent(ticket)}`;

// A refusal of the ticket is final (the document is gone, or the token may not read it); anything else is the
// network, and is retried. A 429 is the host asking for patience, never a refusal.
const isFinal = (err: unknown) => err instanceof ApiError && err.status < 500 && err.status !== 429;

export function openRoomStream(deps: Deps): RoomStream {
  const { io, api, documentId, log } = deps;
  let socket: RoomSocket | null = null;
  let stopped = false;
  let backoff = ROOM_RECONNECT_MIN_MS;
  let reconnecting = false;
  let cancelRetry: (() => void) | null = null;
  let settle!: (end: RoomStreamEnd) => void;
  let fail!: (err: unknown) => void;
  const ended = new Promise<RoomStreamEnd>((resolve, reject) => {
    settle = resolve;
    fail = reject;
  });

  const retry = () => {
    deps.notice('reconnecting…');
    reconnecting = true;
    log(`room reconnect in ${backoff} ms`);
    cancelRetry = io.timer(backoff, () => {
      cancelRetry = null;
      void connect();
    });
    backoff = Math.min(backoff * 2, ROOM_RECONNECT_MAX_MS);
  };

  const connect = async () => {
    let ticket: string;
    try {
      ({ ticket } = await api.json<{ ticket: string }>(
        `/documents/${encodeURIComponent(documentId)}/room-ticket`,
        { method: 'POST' },
      ));
    } catch (err) {
      log(`room ticket failed ${String(err)}`);
      if (stopped) return;
      if (isFinal(err)) return fail(err);
      return retry();
    }
    if (stopped) return;
    const ws = io.openSocket(socketUrl(deps.apiBase, documentId, ticket));
    socket = ws;
    ws.onOpen(() => {
      log('room open');
      backoff = ROOM_RECONNECT_MIN_MS;
      if (reconnecting) deps.onReconnected();
      reconnecting = false;
    });
    ws.onMessage((data) => {
      let frame: unknown;
      try {
        frame = JSON.parse(data);
      } catch {
        log('room frame not JSON');
        return;
      }
      if (
        typeof frame === 'object' &&
        frame !== null &&
        'kind' in frame &&
        frame.kind === 'op' &&
        'op' in frame
      )
        deps.onOp(frame.op);
    });
    ws.onClose((code) => {
      log(`room closed ${code}`);
      socket = null;
      if (stopped) return;
      if (code === DOCUMENT_TRASHED_CLOSE) {
        stopped = true;
        return settle('trashed');
      }
      retry();
    });
  };

  void connect();
  return {
    stop: () => {
      if (stopped) return;
      stopped = true;
      cancelRetry?.();
      socket?.close(NORMAL_CLOSE);
      settle('stopped');
    },
    ended,
  };
}
