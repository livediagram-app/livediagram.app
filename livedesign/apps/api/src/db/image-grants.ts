// Which images a design may serve (docs/specs/009-elements/images.md, "Placement grants"), answered in the design's
// own SQLite (its Durable Object, design-room/design-schema.ts `image_owners`, `image_grants`) by
// @liveworkspace/index-app's placement grants. livedesign supplies what only it knows: how to ask the media service
// who owns an image, how the service names a person (a guest's id is a one-way hash there: media.ts mediaOwner), and
// a team's joined people (liveworkspace accounts). See the kit's image-grants.ts for the rules.
//
// A reference alone (image_refs) does not let a design serve an image: an id pasted into an unrelated design must
// not keep the bytes reachable after its reader loses access to the original. A design serves image X when X's
// owner owns the design, X's owner may place it there right now (they wrote to it since its last push, or are a
// joined member of its team), or the design holds a grant for X: written as the design pushes the images it places
// while X's owner is entitled (design-outbox.ts), and when a copy carries an image its source could serve.

import {
  createImageGrants,
  imageGrantSqlOfD1,
  type ImageGrantItem,
} from '@liveworkspace/index-app';
import { teamPeople } from '../accounts/notify';
import { mediaClient, mediaOwner } from '../media';
import type { DesignEnv } from '../types';

// One per isolate, so a team's people are remembered across designs and requests. The service's and accounts'
// settings are the worker's, the same for every design: the latest env is the one asked.
let current: DesignEnv | null = null;
let grants: ReturnType<typeof createImageGrants> | null = null;

function grantsFor(env: DesignEnv) {
  current = env;
  grants ??= createImageGrants({
    lookupOwner: async (id) => {
      const media = current && mediaClient(current);
      return media ? ((await media.get(id))?.owner ?? null) : null;
    },
    mediaOwnerOf: (personId) => mediaOwner(personId),
    teamMembers: async (teamId) =>
      ((current && (await teamPeople(current, teamId))) ?? [])
        .filter((p) => p.status === 'joined' && p.userId)
        .map((p) => p.userId as string),
  });
  return grants;
}

export function clearImageGrantCachesForTests(): void {
  grants = null;
  current = null;
}

const sqlOf = (env: DesignEnv) => imageGrantSqlOfD1(env.DESIGN_DB);

async function designOf(env: DesignEnv, designId: string): Promise<ImageGrantItem | null> {
  const row = await env.DESIGN_DB.prepare('SELECT owner_id, team_id FROM design WHERE id = ?')
    .bind(designId)
    .first<{ owner_id: string; team_id: string | null }>();
  return row ? { ownerId: row.owner_id || null, teamId: row.team_id } : null;
}

// The people who wrote to the design since its last push: its outbox's edit keys.
const pendingEditKeys = (env: DesignEnv, designId: string) => async () =>
  (
    await env.DESIGN_DB.prepare(`SELECT key FROM outbox WHERE design_id = ? AND kind = 'edit'`)
      .bind(designId)
      .all<{ key: string }>()
  ).results.map((r) => r.key);

// Each image's owner as the media service names them ('' for an id it does not know).
export async function imageOwners(
  env: DesignEnv,
  ids: readonly string[],
): Promise<Map<string, string>> {
  return grantsFor(env).imageOwners(sqlOf(env), ids);
}

// The images of `ids` the design may serve.
export async function servableImageIds(
  env: DesignEnv,
  designId: string,
  ids: readonly string[],
): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const design = await designOf(env, designId);
  if (!design) return new Set();
  return grantsFor(env).servableImageIds(sqlOf(env), design, ids, pendingEditKeys(env, designId));
}

// The byte endpoint's share check: the design places image `imageId` (a tab-scoped visitor's tab only), answered
// from the reference index, never a tab body, AND may serve it.
export async function designServesImage(
  env: DesignEnv,
  designId: string,
  imageId: string,
  onlyTabId: string | null = null,
): Promise<boolean> {
  const placed = await env.DESIGN_DB.prepare(
    `SELECT 1 AS present
       FROM design_tabs dt
       JOIN image_refs r ON r.tab_id = dt.tab_id AND r.image_id = ?1
      WHERE dt.design_id = ?2${onlyTabId === null ? '' : ' AND dt.tab_id = ?3'}
      LIMIT 1`,
  )
    .bind(...(onlyTabId === null ? [imageId, designId] : [imageId, designId, onlyTabId]))
    .first<{ present: number }>();
  if (!placed) return false;
  return (await servableImageIds(env, designId, [imageId])).has(imageId);
}

// As the design pushes the images it places (design-outbox.ts): grant each one whose owner is entitled to place it
// here right now (a teammate, or someone who wrote to it since the last push: `editorKeys`).
export async function grantPlacedImages(
  env: DesignEnv,
  designId: string,
  ids: readonly string[],
  editorKeys: readonly string[],
  now: number,
): Promise<number> {
  if (ids.length === 0) return 0;
  const design = await designOf(env, designId);
  if (!design) return 0;
  return grantsFor(env).grantPlaced(sqlOf(env), design, ids, editorKeys, now);
}
