// The Google Drive mirror's side of the index (liveworkspace/docs/specs/005-drive/drive.md "Contracts > The index"): the per-person
// `drive_mirrored` flag (`/app/people/:id/drive`), and the change signal that tells the service a flagged person's
// own items or folders changed. Its key, and acting for a person with it, are auth.ts's.
//
// A request collects the people whose personal items or folders it changed (touchItem), and once it has
// answered, one indexed read finds which of them are flagged and each is signalled once. Without the DRIVE
// binding nothing is read or sent, so a deployment with no one connected pays nothing.

import { eachLimited } from './app-calls';
import { isDriveCaller } from './auth';
import { isId } from './codec';
import { APP_CALL_CONCURRENCY } from './config';
import type { Env } from './env';
import { badRequest, forbidden, json, noContent, notFound, unauthorized } from './http';

// The service's change route, reached through the DRIVE binding (the host is never looked up).
const CHANGES_URL = 'https://drive/app/changes';

// The people a request changed the personal items or folders of: each is signalled at most once.
export type DriveTouched = Set<string>;

// An item or folder row before or after a change: only a personal one is mirrored, and it is its owner's.
export function touchItem(
  touched: DriveTouched,
  row: { owner_id: string; team_id: string | null },
): void {
  if (row.team_id === null) touched.add(row.owner_id);
}

// Tells the service, for each flagged person among `people`, that their mirror has something to catch up on.
// One read of the flag for all of them; never throws: a failure is logged and the fallback check catches up.
export async function sendDriveSignals(
  env: Env,
  people: Iterable<string>,
  at = Date.now(),
): Promise<void> {
  const drive = env.DRIVE;
  if (!drive) return;
  // A guest is never flagged.
  const ids = [...new Set(people)].filter((id) => !id.startsWith('guest_'));
  if (ids.length === 0) return;
  try {
    const { results } = await env.INDEX_DB.prepare(
      'SELECT person_id FROM drive_people WHERE person_id IN (SELECT value FROM json_each(?))',
    )
      .bind(JSON.stringify(ids))
      .all<{ person_id: string }>();
    if (results.length === 0) return;
    const key = env.DRIVE_KEY_INDEX?.trim() ?? '';
    await eachLimited(results, APP_CALL_CONCURRENCY, async ({ person_id: personId }) => {
      try {
        const res = await drive.fetch(CHANGES_URL, {
          method: 'POST',
          headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
          body: JSON.stringify({ personId, at }),
        });
        if (!res.ok) console.warn('index: drive-signal failed', { status: res.status });
      } catch (err) {
        console.warn('index: drive-signal failed', { status: 0, error: String(err) });
      }
    });
  } catch (err) {
    console.error('index: drive-signal failed', { status: 0, error: String(err) });
  }
}

// /app/people/:id/drive with the service's key: PUT sets the flag, DELETE clears it, GET reads it.
export async function handleDriveFlag(
  request: Request,
  env: Env,
  personId: string,
): Promise<Response> {
  if (!(await isDriveCaller(request, env))) return unauthorized();
  if (!isId(personId) || personId.includes(':')) return badRequest();
  // A guest has no lasting identity to mirror.
  if (personId.startsWith('guest_')) return forbidden();
  const db = env.INDEX_DB;
  if (request.method === 'PUT') {
    // Set again, it keeps the moment it was first set.
    await db
      .prepare('INSERT INTO drive_people (person_id, since) VALUES (?, ?) ON CONFLICT DO NOTHING')
      .bind(personId, Date.now())
      .run();
    return noContent();
  }
  if (request.method === 'DELETE') {
    await db.prepare('DELETE FROM drive_people WHERE person_id = ?').bind(personId).run();
    return noContent();
  }
  if (request.method === 'GET') {
    const row = await db
      .prepare('SELECT 1 AS found FROM drive_people WHERE person_id = ?')
      .bind(personId)
      .first<{ found: number }>();
    return json({ mirrored: row !== null });
  }
  return notFound();
}
