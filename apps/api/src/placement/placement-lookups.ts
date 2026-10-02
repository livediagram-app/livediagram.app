// The database reads behind placement (docs/specs/013-workspace/blueprints/document-placement.md),
// kept apart from the resolver so its judgements stay pure.

import { getFolder, getMembership } from '../db';
import type { Env } from '../types';
import type { PlacementLookups } from './resolve-placement';

export function placementLookups(env: Env): PlacementLookups {
  return {
    async isJoinedMember(teamId, userId) {
      return (await getMembership(env, teamId, userId))?.status === 'joined';
    },
    async getFolder(folderId) {
      const folder = await getFolder(env, folderId);
      return folder ? { ownerId: folder.ownerId, teamId: folder.teamId } : null;
    },
  };
}
