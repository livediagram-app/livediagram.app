// Everything a stored tab's elements need on the way in, in one call. Composed
// into migrateStoredTab (stored-tab.ts), which every stored-tab entry point runs.

import { migrateLegacyGroups } from './legacy-groups';
import { migrateLegacyModeButtons } from './legacy-mode-buttons';
import { migrateLegacyTextSizing } from './legacy-text-sizing';
import { dropUnturnableRotation } from './unturnable-rotation';
import { dropMalformedIds } from './malformed-ids';
import { dropMalformedStyles } from './malformed-styles';
import { dropUnsafeColours } from './unsafe-colours';
import type { Element } from './index';

export function migrateStoredElements(elements: Element[]): Element[] {
  // Malformed styles and catalogue keys are settled first, so no later migration reads them. A stored arrow, stroke
  // or path is a retired element (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part 4):
  // nothing here rewrites its points or bends.
  return dropUnsafeColours(
    dropUnturnableRotation(
      migrateLegacyModeButtons(
        migrateLegacyTextSizing(
          migrateLegacyGroups(dropMalformedIds(dropMalformedStyles(elements))),
        ),
      ),
    ),
  );
}
