// The room's platform surface: everything DocumentRoom asks of the runtime it
// runs on, and nothing more (docs/specs/016-platform/blueprints/self-hosted-runtime.md,
// "Node runtime: the rooms").
//
// The room itself is the same 1,200 lines on both runtimes. It never mentions
// Durable Objects: it stores through the four methods below, accepts sockets
// through one, and reads them back through another. Cloudflare satisfies this
// from \`DurableObjectState\`; the Node runtime satisfies it from a registry and
// a \`ws\` server.

/**
 * One connected client, as the room sees it. Hibernation delivers events through
 * class-level handlers rather than per-socket listeners, so this is deliberately
 * not an EventTarget: the shell owns the listeners and calls the room.
 */
export type RoomSocket = {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  /** Per-socket state that survives eviction on Cloudflare and lives in a map here. */
  serializeAttachment(value: unknown): void;
  deserializeAttachment(): unknown;
};

/**
 * The room's own key/value store — Cloudflare's \`DurableObjectStorage\` minus
 * everything the room does not use. The four methods are the whole surface the
 * ledger, the live poll and the selections adapters need; the two alarm methods
 * are the room's timers.
 */
export type RoomStorage = {
  get<T>(key: string): Promise<T | undefined>;
  put(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<boolean>;
  list<T = unknown>(options?: { prefix?: string }): Promise<Map<string, T>>;
  setAlarm(scheduledTime: number): Promise<void>;
  deleteAlarm(): Promise<void>;
};

export type RoomState = {
  storage: RoomStorage;
  /** Hand the socket to the shell; events come back through the room's handlers. */
  acceptWebSocket(socket: RoomSocket): void;
  getWebSockets(tag?: string): RoomSocket[];
  /** Background work the room does not wait for. */
  waitUntil?(promise: Promise<unknown>): void;
  /** Run once, before any request is served — the room restores its order state here. */
  blockConcurrencyWhile<T>(fn: () => Promise<T>): Promise<T>;
};
