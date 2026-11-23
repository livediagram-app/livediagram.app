// Everything a stored tab's elements need on the way in, in one call. Composed
// into migrateStoredTab (stored-tab.ts), which every stored-tab entry point runs.

import { settleChips } from '@liveworkspace/element-model/attachment';
import { migrateLegacyStrokePoints } from '@liveworkspace/element-model/legacy-stroke-points';
import { dropUnturnableRotation } from '@liveworkspace/element-model/unturnable-rotation';
import { dropMalformedBends } from '@liveworkspace/element-model/malformed-bends';
import { dropMalformedIds } from '@liveworkspace/element-model/malformed-ids';
import { dropMalformedStyles } from './malformed-styles';
import { settleChartRows } from '@liveworkspace/element-model/malformed-chart-rows';
import { dropUnsafeColours } from '@liveworkspace/element-model/unsafe-colours';
import { cleanImageAlts } from './image-alt';
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
  // A stroke given as `{ nx, ny }` points (a model's, through the MCP and edit operations) is packed.
  // An image's alt text is stored clean (docs/specs/009-elements/images.md "Alt text"), whoever wrote it.
  return cleanImageAlts(
    dropUnsafeColours(
      dropUnturnableRotation(
        migrateLegacyStrokePoints(
          settleChartRows(dropMalformedBends(dropMalformedIds(dropMalformedStyles(elements)))),
        ),
      ),
    ),
  );
}
