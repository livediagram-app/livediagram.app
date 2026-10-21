// Everything a stored tab's elements need on the way in, in one call. Composed
// into migrateStoredTab (stored-tab.ts), which every stored-tab entry point runs.

import { migrateLegacyCallouts } from './card';
import { settleChips } from './attachment';
import { dropLegacyDocks } from './legacy-docks';
import { stampLegacyEsKinds } from './legacy-es-kinds';
import { migrateLegacyGroups } from './legacy-groups';
import { migrateLegacySessionButtons } from './legacy-session-buttons';
import { migrateLegacyStrokePoints } from './legacy-stroke-points';
import { migrateLegacyTextSizing } from './legacy-text-sizing';
import { dropUnturnableRotation } from './unturnable-rotation';
import { dropMalformedBends } from './malformed-bends';
import { dropMalformedIds } from './malformed-ids';
import { dropMalformedStyles } from './malformed-styles';
import { settleChartRows } from './malformed-chart-rows';
import { dropUnsafeColours } from './unsafe-colours';
import type { Element } from './index';

export function migrateStoredElements(elements: Element[]): Element[] {
  // Badges, step numbers and pointer notes read settled (docs/specs/009-elements/badge.md): fitted, numbered and on
  // their hosts' points, whoever wrote them, without attaching a loose one that merely sits near a corner.
  return settleChips([], migrateStoredElementsUnsettled(elements), { attachLoose: false });
}

/** The stored-element migrations without the settle: for ONE element at a time (normaliseElement), whose host is not
 *  in its one-element list, so settling it alone would detach every badge, step and pointer note from its host. The
 *  whole list is settled afterwards. */
export function migrateStoredElementsUnsettled(elements: Element[]): Element[] {
  // Malformed styles, catalogue keys, bends and chart rows are settled first, so no later migration reads them.
  return dropUnsafeColours(
    dropUnturnableRotation(
      stampLegacyEsKinds(
        migrateLegacySessionButtons(
          migrateLegacyTextSizing(
            migrateLegacyStrokePoints(
              dropLegacyDocks(
                migrateLegacyGroups(
                  migrateLegacyCallouts(
                    settleChartRows(
                      dropMalformedBends(dropMalformedIds(dropMalformedStyles(elements))),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}
