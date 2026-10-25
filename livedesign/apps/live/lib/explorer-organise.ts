'use client';

// What the shared Explorer reports about keeping things in order (@liveworkspace/explorer OrganiseTelemetry), from
// the editor's Explorer (its panel, its page or the Workbench's) and Settings › Default Folders: folders made,
// re-parented and deleted, a default folder set or cleared, the Trash restored from, deleted from and emptied, and an
// item moved into, within or out of a team. The names the app's own Explorer always sent, each a literal pair so the
// telemetry manifest's coverage test sees it (docs/specs/017-telemetry/telemetry.md). The Explorer on
// liveworkspace.app reports its own.

import type { OrganiseTelemetry } from '@liveworkspace/explorer';
import { track } from './telemetry';

export const trackOrganise: OrganiseTelemetry = (event, type) => {
  switch (event) {
    case 'Folder·Created':
      return track('Folder', 'Created', type ?? undefined);
    case 'Folder·Moved':
      return track('Folder', 'Moved', type ?? undefined);
    case 'Folder·Deleted':
      return track('Folder', 'Deleted', type ?? undefined);
    case 'Folder·Changed':
      return track('Folder', 'Changed', type ?? undefined);
    case 'Folder·Cleared':
      return track('Folder', 'Cleared', type ?? undefined);
    case 'Trash·Restored':
      return track('Trash', 'Restored', type ?? undefined);
    case 'Trash·Deleted':
      return track('Trash', 'Deleted', type ?? undefined);
    case 'Trash·Cleared':
      return track('Trash', 'Cleared', type ?? undefined);
    case 'Team·Added':
      return track('Team', 'Added', 'Design');
    case 'Team·Moved':
      return track('Team', 'Moved', 'Design');
    case 'Team·Removed':
      return track('Team', 'Removed', 'Design');
  }
};
