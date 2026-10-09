// The database reads behind placement (docs/specs/013-workspace/blueprints/document-placement.md,
// docs/specs/013-workspace/blueprints/default-folders.md), kept apart from the resolver so its
// judgements stay pure.

import { getFolder, getMembership, listPlacementDefaults } from '../db';
import type { Runtime } from '../types';
import type { PlacementLookups } from './placement-types';

export function placementLookups(env: Runtime): PlacementLookups {
  return {
    async isJoinedMember(teamId, userId) {
      return (await getMembership(env, teamId, userId))?.status === 'joined';
    },
    async getFolder(folderId) {
      const folder = await getFolder(env, folderId);
      return folder ? { ownerId: folder.ownerId, teamId: folder.teamId } : null;
    },
    async getPlacementDefaults(ownerId) {
      const defaults = await listPlacementDefaults(env, ownerId);
      return new Map(defaults.map((d) => [d.key, d.folderId]));
    },
  };
}
