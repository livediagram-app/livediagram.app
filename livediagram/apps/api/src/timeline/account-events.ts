// Account + housekeeping events (docs/specs/013-workspace/timeline.md §4.5).
//
// The quiet end of the catalogue. An API token about to expire is liveworkspace's to warn about
// (liveworkspace/docs/accounts.md "API tokens"); the feed's forward-looking warning is a share link's
// (document-events.ts recordShareLinkExpiring).

import { dedupeKeyForDay } from '../db/timeline';
import type { Env } from '../types';
import { userScope } from './audience';
import { record } from './record';

export async function recordTokenCreated(
  env: Env,
  token: { id: string; name: string },
  ownerId: string,
): Promise<void> {
  await record(
    env,
    {
      actorId: ownerId,
      sourceType: 'account',
      sourceId: token.id,
      eventType: 'token_created',
      title: 'API Token Created',
      description: token.name,
      snapshot: { tokenName: token.name },
    },
    [userScope(ownerId)],
  );
}

// Coalesced per day like document editing: someone pasting a dozen
// screenshots into a document is one moment, not twelve. The snapshot's
// count is what the renderer reads to say "3 images uploaded".
export async function recordImageUploaded(env: Env, ownerId: string): Promise<void> {
  const now = Date.now();
  const dedupeKey = dedupeKeyForDay(ownerId, now);
  const previous = await env.DB.prepare(
    `SELECT snapshot FROM timeline_events
      WHERE source_type = 'account' AND source_id = ?1
        AND event_type = 'image_uploaded' AND dedupe_key = ?2`,
  )
    .bind(ownerId, dedupeKey)
    .first<{ snapshot: string }>();
  let count = 1;
  if (previous) {
    try {
      const parsed = JSON.parse(previous.snapshot) as { count?: unknown };
      if (typeof parsed.count === 'number') count = parsed.count + 1;
    } catch {
      // Unparseable snapshot: start the count again rather than lose
      // the event. The number is decoration, the event is the point.
    }
  }
  await record(
    env,
    {
      actorId: ownerId,
      sourceType: 'account',
      sourceId: ownerId,
      eventType: 'image_uploaded',
      dedupeKey,
      title: 'Images Uploaded',
      description: count === 1 ? '1 image' : `${count} images`,
      occurredAt: now,
      snapshot: { count },
    },
    [userScope(ownerId)],
  );
}

export async function recordTokenRevoked(
  env: Env,
  token: { id: string; name: string },
  ownerId: string,
): Promise<void> {
  await record(
    env,
    {
      actorId: ownerId,
      sourceType: 'account',
      sourceId: `${token.id}:revoked`,
      eventType: 'token_revoked',
      title: 'API Token Revoked',
      description: token.name,
      snapshot: { tokenName: token.name },
    },
    [userScope(ownerId)],
  );
}

export async function recordFolderCreated(
  env: Env,
  folder: { id: string; name: string },
  ownerId: string,
): Promise<void> {
  await record(
    env,
    {
      actorId: ownerId,
      sourceType: 'account',
      sourceId: folder.id,
      eventType: 'folder_created',
      title: 'Folder Created',
      description: folder.name,
      snapshot: { folderId: folder.id, folderName: folder.name },
    },
    [userScope(ownerId)],
  );
}

export async function recordFolderDeleted(
  env: Env,
  folder: { id: string; name: string },
  ownerId: string,
): Promise<void> {
  await record(
    env,
    {
      actorId: ownerId,
      sourceType: 'account',
      sourceId: `${folder.id}:deleted`,
      eventType: 'folder_deleted',
      title: 'Folder Deleted',
      description: folder.name,
      snapshot: { folderName: folder.name },
    },
    [userScope(ownerId)],
  );
}
