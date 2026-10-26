// A person's settings (liveworkspace/docs/accounts.md "Settings"), kept with the account so every
// app reads the same ones. A row is one owner's settings in one scope: 'all', shown by every app, or
// one app's site id, shown only there. Writes patch keys one by one, so two apps writing different
// keys never undo each other.
import { APP_SITES, type SiteId } from '@liveworkspace/sites';
import { GUEST_ID, USER_ID } from './ids.ts';

// The most one row's JSON may take, in bytes. Also the settings_size check in 0003_settings.sql,
// which is what holds it under concurrent writes.
export const SETTINGS_MAX_BYTES = 16_384;
// A setting's name: short, and safe to name in a JSON path unquoted inside "…".
const KEY = /^[A-Za-z0-9_.-]{1,64}$/;

export type SettingsApp = Exclude<SiteId, 'liveworkspace.app'>;
export type SettingsScope = 'all' | SettingsApp;
export type Prefs = Record<string, unknown>;

const APPS: ReadonlySet<string> = new Set(APP_SITES.map((site) => site.id));

export function isSettingsApp(value: unknown): value is SettingsApp {
  return typeof value === 'string' && APPS.has(value);
}

// An account id, or a guest id: the only owners an app can vouch for.
export function isSettingsOwner(value: unknown): value is string {
  return typeof value === 'string' && (USER_ID.test(value) || GUEST_ID.test(value));
}

export interface Settings {
  all: Prefs;
  app: Prefs;
  // The later of the two rows' last writes; null when neither has been written.
  updatedAt: number | null;
}

export type SettingsResult<T> =
  { ok: true; value: T } | { ok: false; status: number; error: string };
const fail = (status: number, error: string): SettingsResult<never> => ({
  ok: false,
  status,
  error,
});

const encoder = new TextEncoder();
const byteLength = (text: string) => encoder.encode(text).length;

function isPlainObject(value: unknown): value is Prefs {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

// A patch, checked: a plain object of named keys, small enough that it could fit in a row. A null
// value deletes that key. Null when there is no patch for this scope.
export function checkPatch(
  value: unknown,
): { ok: true; patch: Prefs | null } | { ok: false; error: string } {
  if (value === undefined) return { ok: true, patch: null };
  if (!isPlainObject(value)) return { ok: false, error: 'settings_not_object' };
  if (!Object.keys(value).every((key) => KEY.test(key))) {
    return { ok: false, error: 'invalid_setting_key' };
  }
  if (byteLength(JSON.stringify(value)) > SETTINGS_MAX_BYTES) {
    return { ok: false, error: 'settings_too_large' };
  }
  return { ok: true, patch: Object.keys(value).length > 0 ? value : null };
}

type Row = { scope: string; prefs: string; updated_at: number };

function toSettings(rows: Row[]): Settings {
  const settings: Settings = { all: {}, app: {}, updatedAt: null };
  for (const row of rows) {
    settings[row.scope === 'all' ? 'all' : 'app'] = JSON.parse(row.prefs) as Prefs;
    settings.updatedAt = Math.max(settings.updatedAt ?? 0, row.updated_at);
  }
  return settings;
}

// Both of an owner's rows for an app, by the primary key, in one query. With no app, just 'all'.
function readStatement(
  db: D1Database,
  owner: string,
  app: SettingsApp | null,
): D1PreparedStatement {
  return db
    .prepare(
      `SELECT scope, prefs, updated_at FROM settings WHERE owner_id = ? AND scope IN ('all', ?)`,
    )
    .bind(owner, app ?? 'all');
}

export async function readSettings(
  db: D1Database,
  owner: string,
  app: SettingsApp | null,
): Promise<Settings> {
  const { results } = await readStatement(db, owner, app).all<Row>();
  return toSettings(results);
}

// One statement per row: a key the patch names is taken out and set again (so a value is replaced
// whole, never merged into), a null leaves it out, and every other key stays as stored. The merge
// happens in SQLite against the row as it is then, so concurrent writes of different keys both land.
// An account id with no account behind it writes nothing (as writeProfile), so a closed account's still-live access
// token can't write its settings back.
function patchStatement(
  db: D1Database,
  owner: string,
  scope: SettingsScope,
  patch: Prefs,
  now: number,
): D1PreparedStatement {
  const keys = Object.keys(patch);
  const paths = keys.map((_, i) => `?${i + 5}`).join(', ');
  return db
    .prepare(
      `INSERT INTO settings (owner_id, scope, prefs, updated_at)
       SELECT ?1, ?2, json_patch('{}', ?3), ?4
       WHERE substr(?1, 1, 6) = 'guest_' OR EXISTS (SELECT 1 FROM "user" WHERE id = ?1)
       ON CONFLICT (owner_id, scope) DO UPDATE SET
         prefs = json_patch(json_remove(settings.prefs, ${paths}), ?${keys.length + 5}),
         updated_at = excluded.updated_at`,
    )
    .bind(
      owner,
      scope,
      JSON.stringify(patch),
      now,
      ...keys.map((key) => `$."${key}"`),
      JSON.stringify(patch),
    );
}

const tooLarge = (error: unknown) =>
  error instanceof Error && error.message.includes('settings_size');

// Applies the patches for 'all' and for the app, then answers both rows as they now are. One
// batch, so one round trip and one transaction: a patch that would take a row past the limit fails
// the whole write and changes nothing.
export async function writeSettings(
  db: D1Database,
  owner: string,
  app: SettingsApp | null,
  patches: { all?: unknown; app?: unknown },
  now = Date.now(),
): Promise<SettingsResult<Settings>> {
  const all = checkPatch(patches.all);
  if (!all.ok) return fail(400, all.error);
  const own = checkPatch(patches.app);
  if (!own.ok) return fail(400, own.error);
  if (own.patch && !app) return fail(400, 'app_required');

  const statements: D1PreparedStatement[] = [];
  if (all.patch) statements.push(patchStatement(db, owner, 'all', all.patch, now));
  if (own.patch && app) statements.push(patchStatement(db, owner, app, own.patch, now));
  if (statements.length === 0) return { ok: true, value: await readSettings(db, owner, app) };
  statements.push(readStatement(db, owner, app));

  try {
    const results = await db.batch<Row>(statements);
    if (!results.slice(0, -1).some((r) => (r.meta?.changes ?? 0) > 0))
      return fail(404, 'unknown_owner');
    return { ok: true, value: toSettings(results.at(-1)?.results ?? []) };
  } catch (error) {
    if (tooLarge(error)) return fail(413, 'settings_too_large');
    throw error;
  }
}

// Closing an account takes its settings with it.
export async function deleteSettings(db: D1Database, owner: string): Promise<void> {
  await db.prepare('DELETE FROM settings WHERE owner_id = ?').bind(owner).run();
}

// A guest signing in: their settings move to the account. A key the account already has keeps the
// account's value; the guest's other keys fill the gaps, as many as fit under the limit. Then the
// guest's rows go. One batch, so a merge that fails part way leaves both as they were.
export async function mergeGuestSettings(
  db: D1Database,
  guestId: string,
  userId: string,
  now = Date.now(),
): Promise<void> {
  const { results } = await db
    .prepare(`SELECT owner_id, scope, prefs, updated_at FROM settings WHERE owner_id IN (?, ?)`)
    .bind(guestId, userId)
    .all<Row & { owner_id: string }>();
  const guestRows = results.filter((row) => row.owner_id === guestId);
  if (guestRows.length === 0) return;
  const accountRows = new Map(
    results.filter((row) => row.owner_id === userId).map((row) => [row.scope, row]),
  );

  const statements: D1PreparedStatement[] = [];
  for (const row of guestRows) {
    const stored = accountRows.get(row.scope)?.prefs ?? '{}';
    const account = JSON.parse(stored) as Prefs;
    // Counted entry by entry (`"key":value` and its comma), so this stays linear in the row's size.
    let bytes = byteLength(stored);
    let count = Object.keys(account).length;
    const fill: Prefs = {};
    for (const [key, value] of Object.entries(JSON.parse(row.prefs) as Prefs)) {
      if (Object.hasOwn(account, key)) continue;
      const entry = byteLength(JSON.stringify({ [key]: value })) - 2 + (count > 0 ? 1 : 0);
      if (bytes + entry > SETTINGS_MAX_BYTES) continue;
      bytes += entry;
      count += 1;
      fill[key] = value;
    }
    if (Object.keys(fill).length === 0) continue;
    // Patching the account's row onto the guest's keys, as the row stands when this runs, so a key
    // the account wrote since the read above still wins.
    statements.push(
      db
        .prepare(
          `INSERT INTO settings (owner_id, scope, prefs, updated_at) VALUES (?, ?, ?, ?)
           ON CONFLICT (owner_id, scope) DO UPDATE SET
             prefs = json_patch(excluded.prefs, settings.prefs),
             updated_at = excluded.updated_at`,
        )
        .bind(userId, row.scope, JSON.stringify(fill), now),
    );
  }
  statements.push(db.prepare('DELETE FROM settings WHERE owner_id = ?').bind(guestId));
  await db.batch(statements);
}
