// Account + housekeeping events (docs/specs/013-workspace/timeline.md §4.5).
//
// The quiet end of the catalogue, and the only place the feed looks
// FORWARD: the two `*_expiring` events carry the expiry as their
// occurredAt, so they render in the band above Today. That band is why
// someone opens the Timeline before an integration breaks rather than
// after.

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

// Future-dated. Emitted by the daily expiry-warning cron that already
// computes which tokens are inside the 7-day window (docs/specs/015-api/public-api-and-tokens.md), so this
// costs one extra write on a pass that was happening anyway.
export async function recordTokenExpiring(
  env: Env,
  token: { id: string; name: string; expiresAt: number },
  ownerId: string,
): Promise<void> {
  await record(
    env,
    {
      actorId: null,
      sourceType: 'account',
      sourceId: token.id,
      eventType: 'token_expiring',
      title: 'API Token Expiring',
      description: token.name,
      occurredAt: token.expiresAt,
      snapshot: { tokenName: token.name, expiresAt: token.expiresAt },
    },
    [userScope(ownerId)],
  );
}

export async function recordThemeSaved(
  env: Env,
  theme: { id: string; name: string },
  ownerId: string,
): Promise<void> {
  await record(
    env,
    {
      actorId: ownerId,
      sourceType: 'account',
      sourceId: theme.id,
      eventType: 'theme_saved',
      // One card per theme per day, however many times it was saved
      // while being tweaked — but a save next month is a new card, not
      // last month's moved forward.
      dedupeKey: dedupeKeyForDay(ownerId, Date.now()),
      title: 'Theme Saved',
      description: theme.name,
      snapshot: { themeName: theme.name },
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

export async function recordThemeDeleted(
  env: Env,
  theme: { id: string; name: string },
  ownerId: string,
): Promise<void> {
  await record(
    env,
    {
      actorId: ownerId,
      sourceType: 'account',
      sourceId: `${theme.id}:deleted`,
      eventType: 'theme_deleted',
      title: 'Theme Deleted',
      description: theme.name,
      snapshot: { themeName: theme.name },
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
