// Every tab-level migration a stored tab needs on the way in, in one call
// (docs/specs/011-theme/retired-schemes.md): the api worker's tab read and thumbnail render, the
// offline store's tab load and a file import all run this, so a new migration
// is added once and reaches every entry point.
import { upgradeLegacyLinks } from './legacy-links';
import { migrateRetiredScheme } from './retired-schemes';
import { migrateStoredElements } from './stored-elements';
import type { Element, Tab } from './index';

export function migrateStoredTab<
  T extends Pick<Tab, 'theme' | 'backgroundColor' | 'patternColor' | 'elements'>,
>(tab: T): T {
  const schemed = migrateRetiredScheme(tab);
  if (!Array.isArray(schemed.elements)) return schemed;
  // Element links from before the document rename (./legacy-links) are upgraded here too.
  const elements = upgradeLegacyLinks(migrateStoredElements(schemed.elements));
  return elements === schemed.elements ? schemed : { ...schemed, elements };
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * The same migrations for a tab that arrives from outside (an api write, a realtime peer, a file):
 * untrusted, so anything that is not an object whose elements are all objects passes through
 * unchanged for validation to refuse. Run before `isValidTab`, so a former stored shape is
 * converted, not refused.
 */
export function migrateIncomingTab(tab: unknown): unknown {
  if (!isRecord(tab) || !Array.isArray(tab.elements) || !tab.elements.every(isRecord)) return tab;
  return migrateStoredTab(
    tab as Pick<Tab, 'theme' | 'backgroundColor' | 'patternColor' | 'elements'>,
  );
}

/** Untrusted elements (a paste, a file) through the stored-element migrations; non-objects dropped. */
export function migrateIncomingElements(elements: readonly unknown[]): Element[] {
  return migrateStoredElements(elements.filter(isRecord) as unknown as Element[]);
}
