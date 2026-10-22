// Every tab-level migration a stored tab needs on the way in, in one call
// (docs/specs/011-theme/retired-schemes.md): the api worker's tab read and thumbnail render, the
// offline store's tab load and a file import all run this, so a new migration
// is added once and reaches every entry point.
import { upgradeLegacyLinks } from './legacy-links';
import { migrateWhiteboardKind } from './legacy-whiteboard-tab';
import { migrateRetiredScheme } from './retired-schemes';
import { migrateRetiredTheme } from './retired-themes';
import { migrateStoredElements } from './stored-elements';
import { settleDiagramKeys } from './diagram-key';
import { settleStacks } from './stack';
import { settleTabFields } from './tab-fields';
import { tagColoursOf } from './tag-colours';
import type { Element, Tab } from './index';
import { isRecord } from './is-record';

export function migrateStoredTab<
  T extends Pick<Tab, 'theme' | 'backgroundColor' | 'patternColor' | 'elements'>,
>(tab: T): T {
  // A former whiteboard (./legacy-whiteboard-tab) first: it inks the elements the rest then see.
  // Its own fields that renderers read raw (layers, the background colours) are settled before anything reads them.
  const schemed = migrateRetiredTheme(
    migrateRetiredScheme(migrateWhiteboardKind(settleTabFields(tab))),
  );
  if (!Array.isArray(schemed.elements)) return schemed;
  // Element links from before the project rename (./legacy-links) are upgraded here too.
  // A diagram key's rows are re-derived from the tab (docs/specs/009-elements/diagram-key.md), its tag colours included.
  // Keys settle before stacks lay out (docs/specs/009-elements/stack.md): a key's rows come from the arrows and tag
  // colours, not from where anything is, and a key a stack holds must have its height before the stack lays it out.
  const elements = settleStacks(
    settleDiagramKeys(
      upgradeLegacyLinks(migrateStoredElements(schemed.elements)),
      tagColoursOf(schemed as { tagColours?: unknown }),
    ),
  );
  return elements === schemed.elements ? schemed : { ...schemed, elements };
}

/**
 * The same migrations for a tab that arrives from outside (an api write, a realtime peer, a file):
 * untrusted, so anything that is not an object whose elements are all objects passes through
 * unchanged for validation to refuse. Run before `isValidTab`, so a former stored shape is
 * converted, not refused.
 */
export function migrateIncomingTab(tab: unknown): unknown {
  if (!isRecord(tab) || !Array.isArray(tab.elements) || !tab.elements.every(isRecord)) return tab;
  const elements = tab.elements.length;
  return readableOr(tab, elements, () =>
    migrateStoredTab(tab as Pick<Tab, 'theme' | 'backgroundColor' | 'patternColor' | 'elements'>),
  );
}

/** Untrusted elements (a paste, a file) through the stored-element migrations; non-objects dropped. */
export function migrateIncomingElements(elements: readonly unknown[]): Element[] {
  const records = elements.filter(isRecord) as unknown as Element[];
  return readableOr(records, records.length, () => migrateStoredElements(records));
}

// The migrations run before validation and read an element's fields as their types (a chip's label as text): a
// malformed element can make one throw. Untrusted input that does is handed back as it came, for validation to refuse
// as it refuses any malformed input, never thrown out of an api route, a peer's op or an import.
function readableOr<T>(received: T, elements: number, migrate: () => T): T {
  try {
    return migrate();
  } catch {
    console.warn('[migrate] incoming-unreadable', { elements });
    return received;
  }
}
