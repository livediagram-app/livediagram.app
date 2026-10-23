// Which images a document may serve (docs/specs/009-elements/images.md, "Placement grants"), answered in the
// document's own SQLite (its Durable Object, document-schema.ts `image_owners`, `image_grants`) by
// @liveworkspace/index-app's placement grants. livedocuments supplies what only it knows: how to ask the media service
// who owns an image, how the service names a person (a guest's id is a one-way hash there: media.ts mediaOwner), and a
// team's joined people (liveworkspace accounts). See the kit's image-grants.ts for the rules.

import {
  createImageGrants,
  imageGrantSqlOfD1,
  type ImageGrantItem,
} from '@liveworkspace/index-app';
import { mediaClient, mediaOwner } from '../media';
import { teamPeople } from '../person/notify';
import type { DocumentEnv } from '../types';

// One per isolate, so a team's people are remembered across documents and requests. The service's and accounts'
// settings are the worker's, the same for every document: the latest env is the one asked.
let current: DocumentEnv | null = null;
let grants: ReturnType<typeof createImageGrants> | null = null;

function grantsFor(env: DocumentEnv) {
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

const sqlOf = (env: DocumentEnv) => imageGrantSqlOfD1(env.DOCUMENT_DB);

async function documentOf(env: DocumentEnv, documentId: string): Promise<ImageGrantItem | null> {
  const row = await env.DOCUMENT_DB.prepare('SELECT owner_id, team_id FROM document WHERE id = ?')
    .bind(documentId)
    .first<{ owner_id: string; team_id: string | null }>();
  return row ? { ownerId: row.owner_id || null, teamId: row.team_id } : null;
}

// The people who wrote to the document since its last push: its outbox's edit keys.
const pendingEditKeys = (env: DocumentEnv, documentId: string) => async () =>
  (
    await env.DOCUMENT_DB.prepare(`SELECT key FROM outbox WHERE document_id = ? AND kind = 'edit'`)
      .bind(documentId)
      .all<{ key: string }>()
  ).results.map((r) => r.key);

// Each image's owner as the media service names them ('' for an id it does not know).
export async function imageOwners(
  env: DocumentEnv,
  ids: readonly string[],
): Promise<Map<string, string>> {
  return grantsFor(env).imageOwners(sqlOf(env), ids);
}

// The images of `ids` the document may serve.
export async function servableImageIds(
  env: DocumentEnv,
  documentId: string,
  ids: readonly string[],
): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const document = await documentOf(env, documentId);
  if (!document) return new Set();
  return grantsFor(env).servableImageIds(
    sqlOf(env),
    document,
    ids,
    pendingEditKeys(env, documentId),
  );
}

export async function documentMayServeImage(
  env: DocumentEnv,
  documentId: string,
  imageId: string,
): Promise<boolean> {
  return (await servableImageIds(env, documentId, [imageId])).has(imageId);
}

// As the document pushes the images it places (document-outbox.ts): grant each one whose owner is entitled to place
// it here right now (a teammate, or someone who wrote to it since the last push: `editorKeys`).
export async function grantPlacedImages(
  env: DocumentEnv,
  documentId: string,
  ids: readonly string[],
  editorKeys: readonly string[],
  now: number,
): Promise<number> {
  if (ids.length === 0) return 0;
  const document = await documentOf(env, documentId);
  if (!document) return 0;
  return grantsFor(env).grantPlaced(sqlOf(env), document, ids, editorKeys, now);
}

// Grant images outright: a copy's, which its source could serve (document-content.ts importDocumentCopy).
export async function grantImages(
  env: DocumentEnv,
  ids: readonly string[],
  now: number,
): Promise<void> {
  await grantsFor(env).grant(sqlOf(env), ids, now);
}
