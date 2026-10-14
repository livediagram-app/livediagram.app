// Everything a stored tab's elements need on the way in, in one call. Composed
// into migrateStoredTab (stored-tab.ts), which every stored-tab entry point runs.

import { migrateLegacyCallouts } from './card';
import { settleChips } from './attachment';
import { dropLegacyDocks } from './legacy-docks';
import { stampLegacyEsKinds } from './legacy-es-kinds';
import { migrateLegacyGroups } from './legacy-groups';
import { migrateLegacyModeButtons } from './legacy-mode-buttons';
import { migrateLegacyStrokePoints } from './legacy-stroke-points';
import { migrateLegacyTextSizing } from './legacy-text-sizing';
import type { Element } from './index';

export function migrateStoredElements(elements: Element[]): Element[] {
  // Badges and step numbers read settled (docs/specs/009-elements/badge.md): fitted, numbered and on their hosts'
  // points, whoever wrote them, without attaching a loose one that merely sits near a corner.
  const migrated = stampLegacyEsKinds(
    migrateLegacyModeButtons(
      migrateLegacyTextSizing(
        migrateLegacyStrokePoints(
          dropLegacyDocks(migrateLegacyGroups(migrateLegacyCallouts(elements))),
        ),
      ),
    ),
  );
  return settleChips([], migrated, { attachLoose: false });
}
