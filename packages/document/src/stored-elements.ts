// Everything a stored tab's elements need on the way in, in one call. Composed
// into migrateStoredTab (stored-tab.ts), which every stored-tab entry point runs.

import { dropLegacyDocks } from './legacy-docks';
import { migrateLegacyGroups } from './legacy-groups';
import { migrateLegacyStrokePoints } from './legacy-stroke-points';
import { migrateLegacyTextSizing } from './legacy-text-sizing';
import type { Element } from './index';

export function migrateStoredElements(elements: Element[]): Element[] {
  return migrateLegacyTextSizing(
    migrateLegacyStrokePoints(dropLegacyDocks(migrateLegacyGroups(elements))),
  );
}
