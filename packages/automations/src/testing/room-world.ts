// Tests only: what every app's "real room on node:sqlite" world shares (blueprint item-engine.md "Tests"). An app's
// world builds its own room and says who is calling by its own identity; the sockets, the deferred work, the queue,
// the Audit Trail and a rule's default body are the same everywhere.
import type { ItemEvent, ItemRuleBody } from '../item';

// A socket as a room uses one: its attachment, what it was sent, and how it was closed.
export type TestSocket = {
  sent: string[];
  closed: [number, string] | null;
  attachment: unknown;
  send(data: string): void;
  close(code: number, reason: string): void;
  serializeAttachment(value: unknown): void;
  deserializeAttachment(): unknown;
};

export function testSocket(): TestSocket {
  const ws: TestSocket = {
    sent: [],
    closed: null,
    attachment: null,
    send: (data) => void ws.sent.push(data),
    close: (code, reason) => {
      ws.closed = [code, reason];
    },
    serializeAttachment: (value) => {
      ws.attachment = value;
    },
    deserializeAttachment: () => ws.attachment,
  };
  return ws;
}

/** A test Durable Object state made to hold sockets and deferred work as the runtime does. Answers the sockets it
 *  accepted and `settled`, which waits for everything deferred (`waitUntil`). */
export function holdRoomState(state: object): {
  sockets: TestSocket[];
  settled: () => Promise<void>;
} {
  const deferred: Promise<unknown>[] = [];
  const sockets: TestSocket[] = [];
  Reflect.set(state, 'waitUntil', (p: Promise<unknown>) => void deferred.push(p.catch(() => {})));
  // What a revert closes: none are open in a test.
  Reflect.set(state, 'setWebSocketAutoResponse', () => {});
  Reflect.set(state, 'acceptWebSocket', (ws: TestSocket) => void sockets.push(ws));
  Reflect.set(state, 'getWebSockets', () => sockets.filter((ws) => ws.closed === null));
  return {
    sockets,
    settled: async () => {
      while (deferred.length > 0) await Promise.all(deferred.splice(0));
    },
  };
}

type Rows = (query: string) => Record<string, unknown>[];

/** The events waiting on the item's queue, oldest first. */
export const queuedEvents = (rows: Rows): ItemEvent[] =>
  rows('SELECT event FROM automation_queue ORDER BY id').map(
    (r) => JSON.parse(String(r['event'])) as ItemEvent,
  );

/** The Audit Trail, oldest first, each run with how it ended. */
export const storedRuns = (rows: Rows): Record<string, unknown>[] =>
  rows('SELECT result, body FROM automation_runs ORDER BY at, id').map((r) => ({
    ...(JSON.parse(String(r['body'])) as Record<string, unknown>),
    result: r['result'],
  }));

/** A rule as a test posts one: Run by Hand, one Take Snapshot step, under a name of its own. */
export const testRuleBody = (body: Partial<ItemRuleBody> = {}): ItemRuleBody => ({
  name: `Rule ${Math.random().toString(36).slice(2, 8)}`,
  trigger: { kind: 'manual' },
  conditions: [],
  steps: [{ kind: 'take_snapshot', name: 'Kept' }],
  chain: false,
  timeZone: 'UTC',
  ...body,
});
