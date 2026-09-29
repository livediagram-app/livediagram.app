// Every tab-level migration a stored tab needs on the way in, in one call
// (docs/specs/011-theme/retired-schemes.md): the api worker's tab read and thumbnail render, the
// offline store's tab load and a file import all run this, so a new migration
// is added once and reaches every entry point.
import { migrateRetiredScheme } from './retired-schemes';
import { migrateStoredElements } from './stored-elements';
import type { Tab } from './index';

export function migrateStoredTab<
  T extends Pick<Tab, 'theme' | 'backgroundColor' | 'patternColor' | 'elements'>,
>(tab: T): T {
  const schemed = migrateRetiredScheme(tab);
  if (!Array.isArray(schemed.elements)) return schemed;
  const elements = migrateStoredElements(schemed.elements);
  return elements === schemed.elements ? schemed : { ...schemed, elements };
}
