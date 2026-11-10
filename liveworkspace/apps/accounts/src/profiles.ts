// A person's display name and presence colour (liveworkspace/docs/specs/003-accounts/accounts.md "Profiles"): what
// collaborators see on their cursor, their comments and the presence list, the same in every app. An
// account's name is its account name unless it sets a display name of its own; a guest's is whatever
// it sets. Kept with the account, so no app keeps a participants table of its own. An account that signed in with
// Google also has its Google picture ("Profile pictures"), which others see unless its switch is off.
import { profilePictureOf } from '@liveworkspace/sites/picture';
import { GUEST_ID, USER_ID } from './ids.ts';
import { trimInvisible, withoutBidiControls } from '@liveworkspace/api-kit/typed-text';
import { parseTimeZone } from './send-window.ts';

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
// oxlint-disable-next-line no-control-regex -- control characters, which a name shown in every peer's layout has no use for
const CONTROL = /[\u0000-\u001f\u007f]/;

export interface Profile {
  id: string;
  // The display name: its own, or an account's name; null when there is neither.
  name: string | null;
  // A CSS colour, or null for the app's own pick.
  color: string | null;
  // The Google picture others may see: null with none (a guest, an account that never signed in with Google) or
  // with the person's Show My Google Picture switch off.
  picture: string | null;
  // When its row was made and last written; null for an account that has never set one.
  createdAt: number | null;
  updatedAt: number | null;
}

export interface ProfilePatch {
  // A string sets it; null clears it (an account then shows its account name again).
  name?: string | null;
  color?: string | null;
  // Show My Google Picture: whether others see the account's picture.
  showPicture?: boolean;
  // The account's time zone for the send window (accounts.md "The send window"): a zone sets it by hand; null is
  // Automatic again, the browser's zone noted from then on. Only the person's own doors take it.
  timeZone?: string | null;
}

// The person's own profile, as their own Settings reads it: beside what others see, their own picture whatever the
// switch says (their own chrome always shows it) and the switch itself.
export interface OwnProfile extends Profile {
  googlePicture: string | null;
  showPicture: boolean;
  // The zone the send window times them by (null: none seen yet, so the default), and whether it follows their
  // browser (true) or was picked by hand (false). A guest has neither: null and true.
  timeZone: string | null;
  timeZoneAuto: boolean;
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

// A patch, checked and cleaned: a name trimmed (empty clears it), a colour that is safe to paint, and, where the
// caller allows it (the person's own doors, never an app's write for a guest), a zone the runtime knows.
export function checkProfilePatch(
  body: Record<string, unknown>,
  { timeZone: allowZone = false }: { timeZone?: boolean } = {},
): { ok: true; patch: ProfilePatch } | { ok: false; error: string } {
  const patch: ProfilePatch = {};
  if (body.name !== undefined) {
    if (body.name !== null && typeof body.name !== 'string') {
      return { ok: false, error: 'invalid_name' };
    }
    const name = trimInvisible(withoutBidiControls(body.name ?? ''));
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
  if (body.showPicture !== undefined) {
    if (typeof body.showPicture !== 'boolean') return { ok: false, error: 'invalid_show_picture' };
    patch.showPicture = body.showPicture;
  }
  if (allowZone && body.timeZone !== undefined) {
    const zone = body.timeZone === null ? null : parseTimeZone(body.timeZone);
    if (body.timeZone !== null && zone === null) return { ok: false, error: 'invalid_time_zone' };
    patch.timeZone = zone;
  }
  if (
    patch.name === undefined &&
    patch.color === undefined &&
    patch.showPicture === undefined &&
    patch.timeZone === undefined
  ) {
    return { ok: false, error: 'nothing_to_change' };
  }
  return { ok: true, patch };
}

type Row = {
  id: string;
  name: string | null;
  color: string | null;
  // The account's Google picture ("user".image) and the switch (null is on).
  image: string | null;
  show_picture: number | null;
  created_at: number | null;
  updated_at: number | null;
  // The account's zone and its hand-picked mark ("user".timeZone, .timeZoneChosen): the own profile's only.
  time_zone: string | null;
  time_zone_chosen: number | null;
};

const showsPicture = (row: Row) => row.show_picture !== 0;

const toProfile = (row: Row): Profile => ({
  id: row.id,
  name: row.name,
  color: row.color,
  picture: showsPicture(row) ? profilePictureOf(row.image) : null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toOwnProfile = (row: Row): OwnProfile => ({
  ...toProfile(row),
  googlePicture: profilePictureOf(row.image),
  showPicture: showsPicture(row),
  timeZone: row.time_zone,
  timeZoneAuto: row.time_zone_chosen !== 1,
});

// Every named owner that has a profile or is an account, in one query: the ids ride in as one JSON
// array, each found by the primary key of both tables. An id that is neither is left out. The picture
// comes from the same account row as the name, so it costs nothing more.
function readStatement(db: D1Database, ids: string[]): D1PreparedStatement {
  return db
    .prepare(
      `SELECT j.value AS id, COALESCE(p.name, NULLIF(u.name, '')) AS name, p.color AS color,
              u.image AS image, p.show_picture AS show_picture,
              p.created_at AS created_at, p.updated_at AS updated_at,
              u.timeZone AS time_zone, u.timeZoneChosen AS time_zone_chosen
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

// The person's own profile: what others see, their own picture and the switch, and their time zone. Null for an id
// that is neither an account nor a guest with a profile. `notedZone`, the browser's zone the Settings panel sent
// (already checked by parseTimeZone), is kept first in the same batch, as a session sighting is (noteZone).
export async function readOwnProfile(
  db: D1Database,
  owner: string,
  notedZone: string | null = null,
): Promise<OwnProfile | null> {
  if (!notedZone) {
    const row = await readStatement(db, [owner]).first<Row>();
    return row ? toOwnProfile(row) : null;
  }
  const [, read] = await db.batch<Row>([
    noteZone(db, owner, notedZone),
    readStatement(db, [owner]),
  ]);
  const row = read?.results[0];
  return row ? toOwnProfile(row) : null;
}

// A sighting of the browser's zone: written only when it changed, and never over a zone picked by hand.
function noteZone(db: D1Database, owner: string, zone: string): D1PreparedStatement {
  return db
    .prepare(
      'UPDATE "user" SET timeZone = ?2 WHERE id = ?1 AND timeZone IS NOT ?2 AND timeZoneChosen IS NULL',
    )
    .bind(owner, zone);
}

// One owner's presence colour, or null for none (Automatic): one primary-key read, for the account
// menu's avatar (`/get-session`'s `user.color`).
export async function readProfileColour(db: D1Database, owner: string): Promise<string | null> {
  return (await readProfileLook(db, owner)).color;
}

// One owner's colour and picture switch, in one primary-key read: what the ID token carries beside the names
// (`presence_color`, and `picture_hidden` with the switch off). With no row, Automatic and on.
export async function readProfileLook(
  db: D1Database,
  owner: string,
): Promise<{ color: string | null; showPicture: boolean }> {
  const row = await db
    .prepare('SELECT color, show_picture FROM profile WHERE owner_id = ?')
    .bind(owner)
    .first<{ color: string | null; show_picture: number | null }>();
  return { color: row?.color ?? null, showPicture: row?.show_picture !== 0 };
}

// A Google sign-in's picture onto the account ("Profile pictures"): Google's `picture` claim, or null when it
// isn't one this platform draws. Written only when it changed, so a sign-in with the same picture writes nothing.
export async function storeAccountPicture(
  db: D1Database,
  userId: string,
  picture: unknown,
): Promise<void> {
  await db
    .prepare('UPDATE "user" SET image = ?2 WHERE id = ?1 AND image IS NOT ?2')
    .bind(userId, profilePictureOf(picture))
    .run();
}

// `/get-session`'s answer with the account's presence colour on its user (`user.color`), so
// liveworkspace.app's header paints its avatar in it without a request of its own. Any other answer
// (signed out, an error) is passed on as it was. `timeZone`, the browser's zone the page sent (already checked by
// parseTimeZone), is kept on the account for the send window (accounts.md "The send window") in the same round
// trip, written only when it changed and never over a zone picked by hand.
export async function withSessionColour(
  response: Response,
  db: D1Database,
  timeZone: string | null = null,
): Promise<Response> {
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
  const color = await (
    timeZone ? readColourNotingZone(db, id, timeZone) : readProfileColour(db, id)
  ).catch(() => null);
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  return new Response(JSON.stringify({ ...body, user: { ...user, color } }), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// The colour read and the zone's write in one batch: a sighting that changes nothing writes nothing.
async function readColourNotingZone(
  db: D1Database,
  owner: string,
  timeZone: string,
): Promise<string | null> {
  const [read] = await db.batch<{ color: string | null }>([
    db.prepare('SELECT color FROM profile WHERE owner_id = ?').bind(owner),
    noteZone(db, owner, timeZone),
  ]);
  return read?.results?.[0]?.color ?? null;
}

// Sets the fields the patch names and leaves the rest, in one upsert, then answers the profile as it
// now is (one batch, one round trip). An account id with no account behind it is refused, so a
// closed account can't be written back. A time zone goes on the account's own row: a zone picked by hand is marked
// so no sighting overwrites it; Automatic (null) clears the mark and keeps `notedZone`, the browser's zone this
// request carried, at once (with none, the next sighting writes it). A patch of the zone alone makes no profile row.
export async function writeProfile(
  db: D1Database,
  owner: string,
  patch: ProfilePatch,
  now = Date.now(),
  notedZone: string | null = null,
): Promise<ProfileResult<OwnProfile>> {
  const statements: D1PreparedStatement[] = [];
  if (patch.name !== undefined || patch.color !== undefined || patch.showPicture !== undefined) {
    statements.push(upsertStatement(db, owner, patch, now));
  }
  if (patch.timeZone !== undefined) {
    statements.push(
      patch.timeZone === null
        ? db
            .prepare(
              'UPDATE "user" SET timeZoneChosen = NULL, timeZone = COALESCE(?2, timeZone) WHERE id = ?1',
            )
            .bind(owner, notedZone)
        : db
            .prepare('UPDATE "user" SET timeZone = ?2, timeZoneChosen = 1 WHERE id = ?1')
            .bind(owner, patch.timeZone),
    );
  }
  statements.push(readStatement(db, [owner]));
  const results = await db.batch<Row>(statements);
  const row = results[results.length - 1]?.results[0];
  return row ? { ok: true, value: toOwnProfile(row) } : fail(404, 'unknown_owner');
}

// The upsert of the fields a patch names, gated so a closed account's id makes no row.
function upsertStatement(
  db: D1Database,
  owner: string,
  patch: ProfilePatch,
  now: number,
): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO profile (owner_id, name, color, show_picture, created_at, updated_at)
       SELECT ?1, ?2, ?3, ?7, ?4, ?4
       WHERE substr(?1, 1, 6) = 'guest_' OR EXISTS (SELECT 1 FROM "user" WHERE id = ?1)
       ON CONFLICT (owner_id) DO UPDATE SET
         name = CASE WHEN ?5 THEN excluded.name ELSE profile.name END,
         color = CASE WHEN ?6 THEN excluded.color ELSE profile.color END,
         show_picture = CASE WHEN ?7 IS NOT NULL THEN excluded.show_picture ELSE profile.show_picture END,
         updated_at = excluded.updated_at`,
    )
    .bind(
      owner,
      patch.name ?? null,
      patch.color ?? null,
      now,
      patch.name !== undefined ? 1 : 0,
      patch.color !== undefined ? 1 : 0,
      patch.showPicture === undefined ? null : patch.showPicture ? 1 : 0,
    );
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
