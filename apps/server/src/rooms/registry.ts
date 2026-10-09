import type { RoomHandle, RoomHost } from '@livediagram/runtime';
import type { Runtime } from '@livediagram/api';
import type { SqliteDb } from '../runtime/sqlite-db';
import { NodeRoom } from './node-room';

// The process's rooms, keyed by document id
// (docs/specs/016-platform/blueprints/self-hosted-runtime.md, "Node runtime: the
// rooms").
//
// Cloudflare routes a document id to a Durable Object through \`idFromName\`; here
// it is a Map. The difference that matters is eviction: a Durable Object
// hibernates (sockets stay), a Node room with nobody connected and nothing
// scheduled leaves memory entirely, and the next request builds it again from
// the same SQLite rows.

/** How long a room with no sockets and no timer stays in memory. */
export const ROOM_IDLE_MS = 5 * 60 * 1000;

export type RoomRegistryOptions = {
  env: Runtime;
  sqlite: SqliteDb;
  waitUntil: (promise: Promise<unknown>) => void;
  now?: () => number;
};

export class RoomRegistry implements RoomHost {
  private readonly rooms = new Map<string, NodeRoom>();
  private readonly options: RoomRegistryOptions;

  constructor(options: RoomRegistryOptions) {
    this.options = options;
  }

  /** The seam's room host: what \`room-client.ts\` calls. */
  for(documentId: string): RoomHandle {
    const room = this.ensure(documentId);
    return {
      fetch: async (input, init) => {
        // The seam speaks fetch's own shape; a room call is always a Request by
        // the time it matters, so the two forms are folded here.
        const request = input instanceof Request ? input : new Request(input, init);
        // The room restores its order state before it answers anything.
        await room.ready;
        return room.fetch(request);
      },
    };
  }

  ensure(documentId: string): NodeRoom {
    const existing = this.rooms.get(documentId);
    if (existing) return existing;
    const room = new NodeRoom({
      documentId,
      env: this.options.env,
      sqlite: this.options.sqlite,
      waitUntil: this.options.waitUntil,
      ...(this.options.now ? { now: this.options.now } : {}),
    });
    this.rooms.set(documentId, room);
    return room;
  }

  get(documentId: string): NodeRoom | undefined {
    return this.rooms.get(documentId);
  }

  size(): number {
    return this.rooms.size;
  }

  /** Drop the rooms nobody is in and nothing is scheduled for. Returns their ids. */
  sweep(): string[] {
    const now = this.options.now?.() ?? Date.now();
    const evicted: string[] = [];
    for (const [documentId, room] of this.rooms) {
      if (now - room.idleSince() >= ROOM_IDLE_MS) {
        this.rooms.delete(documentId);
        evicted.push(documentId);
      }
    }
    return evicted;
  }

  /** Shut every room down: sockets closed with a reconnectable code, state intact. */
  async closeAll(code: number, reason: string): Promise<void> {
    const rooms = [...this.rooms.values()];
    this.rooms.clear();
    await Promise.all(rooms.map((room) => room.shutdown(code, reason)));
  }
}
