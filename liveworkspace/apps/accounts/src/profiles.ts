// A person's display name and presence colour (liveworkspace/docs/accounts.md "Profiles"): what
// collaborators see on their cursor, their comments and the presence list, the same in every app. An
// account's name is its account name unless it sets a display name of its own; a guest's is whatever
// it sets. Kept with the account, so no app keeps a participants table of its own.
import { GUEST_ID, USER_ID } from './ids.ts';

// The most ids one read may name: a presence list's worth, in one query.
export const MAX_PROFILE_IDS = 100;
// The apps' own limits (MAX_PARTICIPANT_NAME_LEN and MAX_COLOR_LEN in each app's api-schema), and the
// checks on the profile table.
export const PROFILE_NAME_MAX = 120;
export const PROFILE_COLOR_MAX = 64;

// What no colour contains: a way out of a CSS value (a quote, a semicolon, a brace, an escape), or a
// function that loads something. Every colour CSS has (hex, a name, rgb(), hsl(), oklch(),
// color-mix(), var()) passes. The apps' isSafeColourValue, since a colour is painted into every
// peer's CSS.
const NOT_A_COLOUR = /[\\;{}<>"'`]|url|image|src\s*\(|element\s*\(|cross-fade|paint\s*\(/i;
// Control characters, which a name shown in every peer's layout has no use for.
// oxlint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f]/;

export interface Profile {
  id: string;
  // The display name: its own, or an account's name; null when there is neither.
  name: string | null;
  // A CSS colour, or null for the app's own pick.
  color: string | null;
  // When its row was made and last written; null for an account that has never set one.
  createdAt: number | null;
  updatedAt: number | null;
}

export interface ProfilePatch {
  // A string sets it; null clears it (an account then shows its account name again).
  name?: string | null;
  color?: string | null;
}

export type ProfileResult<T> =
  { ok: true; value: T } | { ok: false; status: number; error: string };
const fail = (status: number, error: string): ProfileResult<never> => ({
  ok: false,
  status,
  error,
});

export function isProfileOwner(value: unknown): value is string {
  return typeof value === 'string' && (USER_ID.test(value) || GUEST_ID.test(value));
}

// A patch, checked and cleaned: a name trimmed (empty clears it), a colour that is safe to paint.
export function checkProfilePatch(
  body: Record<string, unknown>,
): { ok: true; patch: ProfilePatch } | { ok: false; error: string } {
  const patch: ProfilePatch = {};
  if (body.name !== undefined) {
    if (body.name !== null && typeof body.name !== 'string') {
      return { ok: false, error: 'invalid_name' };
    }
    const name = body.name?.trim() ?? '';
    if (name.length > PROFILE_NAME_MAX || CONTROL.test(name)) {
      return { ok: false, error: 'invalid_name' };
    }
    patch.name = name || null;
  }
  if (body.color !== undefined) {
    if (body.color !== null && typeof body.color !== 'string') {
      return { ok: false, error: 'invalid_color' };
    }
    const color = body.color?.trim() ?? '';
    if (color.length > PROFILE_COLOR_MAX || NOT_A_COLOUR.test(color) || CONTROL.test(color)) {
      return { ok: false, error: 'invalid_color' };
    }
    patch.color = color || null;
  }
  if (patch.name === undefined && patch.color === undefined) {
    return { ok: false, error: 'nothing_to_change' };
  }
  return { ok: true, patch };
}

type Row = {
  id: string;
  name: string | null;
  color: string | null;
  created_at: number | null;
  updated_at: number | null;
};

const toProfile = (row: Row): Profile => ({
  id: row.id,
  name: row.name,
  color: row.color,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

// Every named owner that has a profile or is an account, in one query: the ids ride in as one JSON
// array, each found by the primary key of both tables. An id that is neither is left out.
function readStatement(db: D1Database, ids: string[]): D1PreparedStatement {
  return db
    .prepare(
      `SELECT j.value AS id, COALESCE(p.name, NULLIF(u.name, '')) AS name, p.color AS color,
              p.created_at AS created_at, p.updated_at AS updated_at
       FROM json_each(?) j
       LEFT JOIN profile p ON p.owner_id = j.value
       LEFT JOIN "user" u ON u.id = j.value
       WHERE p.owner_id IS NOT NULL OR u.id IS NOT NULL`,
    )
    .bind(JSON.stringify(ids));
}

export async function readProfiles(db: D1Database, ids: string[]): Promise<Profile[]> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return [];
  const { results } = await readStatement(db, unique).all<Row>();
  return results.map(toProfile);
}

// One owner's presence colour, or null for none (Automatic): one primary-key read, for the account
// menu's avatar (the ID token's `presence_color` claim, and `/get-session`'s `user.color`).
export async function readProfileColour(db: D1Database, owner: string): Promise<string | null> {
  const row = await db
    .prepare('SELECT color FROM profile WHERE owner_id = ?')
    .bind(owner)
    .first<{ color: string | null }>();
  return row?.color ?? null;
}

// `/get-session`'s answer with the account's presence colour on its user (`user.color`), so
// liveworkspace.app's header paints its avatar in it without a request of its own. Any other answer
// (signed out, an error) is passed on as it was.
export async function withSessionColour(response: Response, db: D1Database): Promise<Response> {
  if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
    return response;
  }
  const body = (await response
    .clone()
    .json()
    .catch(() => null)) as { user?: { id?: unknown } } | null;
  const user = body?.user;
  if (!user || typeof user.id !== 'string') return response;
  const id = user.id;
  const color = await readProfileColour(db, id).catch(() => null);
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  return new Response(JSON.stringify({ ...body, user: { ...user, color } }), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// Sets the fields the patch names and leaves the rest, in one upsert, then answers the profile as it
// now is (one batch, one round trip). An account id with no account behind it is refused, so a
// closed account can't be written back.
export async function writeProfile(
  db: D1Database,
  owner: string,
  patch: ProfilePatch,
  now = Date.now(),
): Promise<ProfileResult<Profile>> {
  const [, read] = await db.batch<Row>([
    db
      .prepare(
        `INSERT INTO profile (owner_id, name, color, created_at, updated_at)
         SELECT ?1, ?2, ?3, ?4, ?4
         WHERE substr(?1, 1, 6) = 'guest_' OR EXISTS (SELECT 1 FROM "user" WHERE id = ?1)
         ON CONFLICT (owner_id) DO UPDATE SET
           name = CASE WHEN ?5 THEN excluded.name ELSE profile.name END,
           color = CASE WHEN ?6 THEN excluded.color ELSE profile.color END,
           updated_at = excluded.updated_at`,
      )
      .bind(
        owner,
        patch.name ?? null,
        patch.color ?? null,
        now,
        patch.name !== undefined ? 1 : 0,
        patch.color !== undefined ? 1 : 0,
      ),
    readStatement(db, [owner]),
  ]);
  const row = read?.results[0];
  return row ? { ok: true, value: toProfile(row) } : fail(404, 'unknown_owner');
}

// Closing an account takes its profile with it.
export async function deleteProfile(db: D1Database, owner: string): Promise<void> {
  await db.prepare('DELETE FROM profile WHERE owner_id = ?').bind(owner).run();
}

// A guest signing in: the account keeps its own name and colour, and takes the guest's where it has
// none (a name only when the account has no name at all). Then the guest's row goes, and the record of
// when the guest id was last seen. One batch, so a merge that fails part way leaves both as they were.
export async function mergeGuestProfile(
  db: D1Database,
  guestId: string,
  userId: string,
  now = Date.now(),
): Promise<void> {
  await db.batch([
    db
      .prepare(
        `INSERT INTO profile (owner_id, name, color, created_at, updated_at)
         SELECT ?1,
                CASE WHEN COALESCE((SELECT name FROM "user" WHERE id = ?1), '') = '' THEN g.name END,
                g.color, ?3, ?3
         FROM profile g WHERE g.owner_id = ?2
         ON CONFLICT (owner_id) DO UPDATE SET
           name = COALESCE(profile.name, excluded.name),
           color = COALESCE(profile.color, excluded.color),
           updated_at = excluded.updated_at`,
      )
      .bind(userId, guestId, now),
    db.prepare('DELETE FROM profile WHERE owner_id = ?').bind(guestId),
    db.prepare('DELETE FROM guest_seen WHERE guest_id = ?').bind(guestId),
  ]);
}
