import type { RoomSocket, RoomState } from '@livediagram/api';
import type { SqliteDb } from '../runtime/sqlite-db';
import { createRoomStorage, storedAlarm } from './room-store';

// The room's platform surface, answered from the process
// (docs/specs/016-platform/blueprints/self-hosted-runtime.md, "Node runtime: the
// rooms"). Cloudflare answers the same questions from \`DurableObjectState\`; the
// room cannot tell the difference.

export type NodeRoomState = RoomState & {
  sockets(): RoomSocket[];
  addSocket(socket: RoomSocket): void;
  removeSocket(socket: RoomSocket): void;
  /** Resolves once the constructor gate has run — the room's state is restored. */
  settled(): Promise<void>;
  /** The alarm this room is still owed, as stored (survives a restart). */
  alarmAt(): number | null;
};

export type RoomStateOptions = {
  roomId: string;
  sqlite: SqliteDb;
  waitUntil: (promise: Promise<unknown>) => void;
  onAlarmChange: (at: number | null) => void;
};

export function createRoomState(options: RoomStateOptions): NodeRoomState {
  const sockets = new Set<RoomSocket>();
  const storage = createRoomStorage({
    roomId: options.roomId,
    sqlite: options.sqlite,
    onAlarmChange: options.onAlarmChange,
  });

  // The room restores its order state in the constructor and asks the runtime to
  // hold requests until it is done. Cloudflare gates on this; here it is a
  // promise the room's shell awaits before its first request.
  let gate: Promise<unknown> = Promise.resolve();

  return {
    storage,
    acceptWebSocket: (socket) => {
      sockets.add(socket);
    },
    getWebSockets: () => [...sockets],
    waitUntil: (promise) => options.waitUntil(promise),
    blockConcurrencyWhile: <T>(fn: () => Promise<T>): Promise<T> => {
      gate = gate.then(fn, fn);
      return gate as Promise<T>;
    },
    sockets: () => [...sockets],
    addSocket: (socket) => {
      sockets.add(socket);
    },
    removeSocket: (socket) => {
      sockets.delete(socket);
    },
    settled: async () => {
      await gate;
    },
    alarmAt: () => storedAlarm(options.sqlite, options.roomId),
  };
}
