// Everything a stored tab's elements need on the way in, in one call. Composed
// into migrateStoredTab (stored-tab.ts), which every stored-tab entry point runs.

import { migrateLegacyGroups } from './legacy-groups';
import { migrateLegacyModeButtons } from './legacy-mode-buttons';
import { migrateLegacyStrokePoints } from './legacy-stroke-points';
import { migrateLegacyTextSizing } from './legacy-text-sizing';
import { dropUnturnableRotation } from './unturnable-rotation';
import { dropMalformedBends } from './malformed-bends';
import { dropMalformedIds } from './malformed-ids';
import { dropMalformedStyles } from './malformed-styles';
import { dropUnsafeColours } from './unsafe-colours';
import type { Element } from './index';

export function migrateStoredElements(elements: Element[]): Element[] {
  // Malformed styles, catalogue keys and bends are settled first, so no later migration reads them.
  return dropUnsafeColours(
    dropUnturnableRotation(
      migrateLegacyModeButtons(
        migrateLegacyTextSizing(
          migrateLegacyStrokePoints(
            migrateLegacyGroups(
              dropMalformedBends(dropMalformedIds(dropMalformedStyles(elements))),
            ),
          ),
        ),
      ),
    ),
  );
}
