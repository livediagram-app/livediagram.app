import type { RoomStorage } from '@livediagram/api';
import type { SqliteDb } from '../runtime/sqlite-db';

// The room's key/value store, on the same SQLite file as everything else
// (docs/specs/016-platform/blueprints/self-hosted-runtime.md, "Node runtime: the
// rooms"). Cloudflare keeps this inside the Durable Object; here it is one table,
// because a room's state must outlive the process that happened to be hosting it.
//
// The alarms live in the same table under a reserved key: Cloudflare persists
// them, so a room that wakes after a restart still knows it owed a sweep.
//
// Every value is JSON: the adapters above store objects, and the two scalar
// shapes they use (a number, a string) round-trip through JSON unchanged.

const ALARM_KEY = '__alarm__';

export type RoomStoreOptions = {
  roomId: string;
  sqlite: SqliteDb;
  /** Called whenever the alarm moves, so the shell can re-arm its timer. */
  onAlarmChange?: (at: number | null) => void;
};

export function createRoomStorage(options: RoomStoreOptions): RoomStorage {
  const { roomId, sqlite } = options;
  sqlite.sql.exec(
    `CREATE TABLE IF NOT EXISTS room_kv (
      room TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      PRIMARY KEY (room, key)
    ) WITHOUT ROWID`,
  );
  const read = sqlite.sql.prepare('SELECT value FROM room_kv WHERE room = ? AND key = ?');
  const write = sqlite.sql.prepare(
    'INSERT INTO room_kv (room, key, value) VALUES (?, ?, ?) ON CONFLICT (room, key) DO UPDATE SET value = excluded.value',
  );
  const drop = sqlite.sql.prepare('DELETE FROM room_kv WHERE room = ? AND key = ?');
  const listPrefix = sqlite.sql.prepare(
    'SELECT key, value FROM room_kv WHERE room = ? AND key LIKE ? ORDER BY key',
  );

  const decode = (raw: unknown): unknown => JSON.parse(String(raw));

  return {
    get: async <T>(key: string) => {
      const row = read.get(roomId, key) as { value?: string } | undefined;
      return row?.value === undefined ? undefined : (decode(row.value) as T);
    },
    put: async (key, value) => {
      write.run(roomId, key, JSON.stringify(value));
    },
    delete: async (key) => {
      const before = sqlite.sql
        .prepare('SELECT COUNT(*) AS n FROM room_kv WHERE room = ? AND key = ?')
        .get(roomId, key) as { n: number };
      drop.run(roomId, key);
      return before.n > 0;
    },
    list: async <T>(opts?: { prefix?: string }) => {
      const prefix = opts?.prefix ?? '';
      const rows = listPrefix.all(roomId, `${prefix}%`) as { key: string; value: string }[];
      const found = new Map<string, T>();
      for (const row of rows) {
        if (row.key === ALARM_KEY) continue;
        found.set(row.key, decode(row.value) as T);
      }
      return found;
    },
    setAlarm: async (scheduledTime: number) => {
      write.run(roomId, ALARM_KEY, JSON.stringify(scheduledTime));
      options.onAlarmChange?.(scheduledTime);
    },
    deleteAlarm: async () => {
      drop.run(roomId, ALARM_KEY);
      options.onAlarmChange?.(null);
    },
  };
}

/** The alarm a stored room is still owed, for a shell re-arming after a restart. */
export function storedAlarm(sqlite: SqliteDb, roomId: string): number | null {
  const row = sqlite.sql
    .prepare('SELECT value FROM room_kv WHERE room = ? AND key = ?')
    .get(roomId, ALARM_KEY) as { value?: string } | undefined;
  if (!row?.value) return null;
  const at = Number(JSON.parse(row.value));
  return Number.isFinite(at) ? at : null;
}
