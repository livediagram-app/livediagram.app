// Everything a stored tab's elements need on the way in, in one call: the
// api worker's `rowToTab`, the offline store's tab load and a file import all
// run this, so a new migration is added once and reaches every entry point.

import { dropLegacyDocks } from './legacy-docks';
import { migrateLegacyGroups } from './legacy-groups';
import type { Element } from './index';

export function migrateStoredElements(elements: Element[]): Element[] {
  return dropLegacyDocks(migrateLegacyGroups(elements));
}
