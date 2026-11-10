// What Home's Spaces tiles show of each space the person is in (`GET /spaces/previews`): its newest few items and how many it holds
// (liveworkspace/docs/specs/004-index/one-explorer.md "Spaces, on Home"). The person's own space comes first, then each
// team their token names, in its order. One D1 batch of two statements whatever the number of teams: the scopes go in
// as one `json_each` parameter (no UNION chain, two bound parameters at most), each space's newest items are its own
// walk of `items_live` (or `items_live_app`, LIMIT 4), and each count stops at FOLDER_PREVIEW_COUNT_CAP, so a space of
// 100,000 items costs what one of a thousand does.

import {
  FOLDER_PREVIEW_COUNT_CAP,
  FOLDER_PREVIEW_ITEMS,
  isApp,
  type App,
  type SpacePreview,
} from '@liveworkspace/index-client';
import { personalScope, teamScope, type Person } from './auth';
import type { PersonContext } from './context';
import type { Env } from './env';
import type { BuiltQuery } from './folder-previews';
import { badRequest, json, notFound } from './http';
import { decorate, ITEM_COLUMNS, type ItemRow } from './rows';

/** The person's spaces in the order the tiles take them: their own, then each team in the token's order. */
export function spacesOf(person: Person): { scope: string; teamId: string | null }[] {
  return [
    { scope: personalScope(person.id), teamId: null },
    ...[...new Set(person.teams)].map((id) => ({ scope: teamScope(id), teamId: id })),
  ];
}

/** The two statements of one read: each space's newest items, and each space's (capped) count. */
export function spacePreviewQueries(
  person: Person,
  app: App | null,
): { items: BuiltQuery; counts: BuiltQuery } {
  const scopes = JSON.stringify(spacesOf(person).map((s) => s.scope));
  const appWhere = app ? 'AND x.app = ?' : '';
  const appArgs = app ? [app] : [];
  return {
    items: {
      sql: `SELECT ${ITEM_COLUMNS} FROM json_each(?) s JOIN items i ON i.id IN (
          SELECT x.id FROM items x WHERE x.scope = s.value AND x.trashed_at IS NULL ${appWhere}
          ORDER BY x.updated_at DESC, x.id DESC LIMIT ${FOLDER_PREVIEW_ITEMS})
        ORDER BY s.key, i.updated_at DESC, i.id DESC`,
      args: [scopes, ...appArgs],
    },
    counts: {
      sql: `SELECT s.value AS scope, (SELECT COUNT(*) FROM (
          SELECT 1 FROM items x WHERE x.scope = s.value AND x.trashed_at IS NULL ${appWhere}
          LIMIT ${FOLDER_PREVIEW_COUNT_CAP})) AS n
        FROM json_each(?) s`,
      args: [...appArgs, scopes],
    },
  };
}

export async function spacePreviews(
  env: Env,
  person: Person,
  app: App | null,
): Promise<SpacePreview[]> {
  const spaces = spacesOf(person);
  const q = spacePreviewQueries(person, app);
  const db = env.INDEX_DB;
  const [items, counts] = (await db.batch([
    db.prepare(q.items.sql).bind(...q.items.args),
    db.prepare(q.counts.sql).bind(...q.counts.args),
  ])) as [D1Result<ItemRow>, D1Result<{ scope: string; n: number }>];
  const previews = spaces.map((s): SpacePreview => ({ teamId: s.teamId, itemCount: 0, items: [] }));
  const byScope = new Map(spaces.map((s, k) => [s.scope, previews[k]!]));
  for (const row of counts.results) {
    const preview = byScope.get(row.scope);
    if (preview) preview.itemCount = row.n;
  }
  // A personal item has no team and a team's names it, so each lands in its own space.
  const byTeam = new Map(previews.map((p) => [p.teamId, p]));
  for (const item of await decorate(env, person, items.results)) {
    byTeam.get(item.teamId)?.items.push(item);
  }
  return previews;
}

export async function handleSpacePreviews(ctx: PersonContext): Promise<Response> {
  const { env, url, person, request, segments } = ctx;
  if (segments.length !== 2 || segments[1] !== 'previews' || request.method !== 'GET') {
    return notFound();
  }
  // An app acting for a person sees only its own items.
  const app = person.app ?? url.searchParams.get('app');
  if (app !== null && !isApp(app)) return badRequest('invalid_app');
  return json({ spaces: await spacePreviews(env, person, app) });
}
