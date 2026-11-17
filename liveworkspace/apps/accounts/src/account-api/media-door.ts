// The account API's door for the media service (account-api.ts): which of the teams it holds a Library or a gallery
// for are deleted, so its daily run deletes those (liveworkspace/docs/specs/006-media/libraries.md "Account and guest
// lifecycle").

import type { Env } from '../env.ts';
import { sameSecret } from '../secrets.ts';
import { error, json, readBody } from './http.ts';

// The most ids one call may ask about.
export const MAX_DELETED_TEAM_IDS = 100;

// POST /api/account/media/teams-deleted {ids}: those of `ids` whose team is deleted. A live team, and an id that is
// no team, are left out, so the service never deletes for a team that still stands.
export async function handleMediaTeamsDeleted(request: Request, env: Env): Promise<Response> {
  const key = env.ACCOUNTS_KEY_MEDIA?.trim();
  const sent = request.headers.get('Authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (request.method !== 'POST' || !key) return error(404, 'not_found');
  if (!sent || !(await sameSecret(sent, key))) return error(401, 'unauthorized');
  const { ids } = await readBody(request);
  if (!Array.isArray(ids) || ids.length > MAX_DELETED_TEAM_IDS) return error(400, 'too_many_ids');
  const asked = ids.filter((v): v is string => typeof v === 'string' && v.length > 0);
  if (asked.length === 0) return json({ deleted: [] });
  const { results } = await env.AUTH_DB.prepare(
    `SELECT id FROM team
      WHERE deletedAt IS NOT NULL AND id IN (SELECT value FROM json_each(?))`,
  )
    .bind(JSON.stringify(asked))
    .all<{ id: string }>();
  return json({ deleted: results.map((r) => r.id) });
}
