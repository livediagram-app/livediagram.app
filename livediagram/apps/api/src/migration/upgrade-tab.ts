// livediagram's stored-tab upgrades for the migration's splitter (docs/migration.md step 3, "Each tab is upgraded
// before it moves"): every upgrade `migrateStoredTab` (@livediagram/document stored-tab.ts) runs, in its order, but
// WITHOUT `dropRetiredPages` and `dropRetiredPlan`, so a former Pages or Plan tab keeps its pages, articles, boards
// and Plan-only elements for liveplanner, livedocuments and livedesign to read.
//
// RECONCILE: this mirrors migrateStoredTab by hand. Once @livediagram/document's stored-tab.ts takes an option to
// keep the retired content, this becomes a call to it; until then a new upgrade added there must be added here too.
// A body the upgrades can't read (a malformed element) is handed back as it came, as migrateIncomingTab does.

import {
  dropCustomTheme,
  migrateRetiredScheme,
  migrateRetiredTheme,
  migrateStoredElements,
  migrateWhiteboardKind,
  settleDiagramKeys,
  settleStacks,
  settleTabFields,
  tagColoursOf,
  upgradeLegacyLinks,
  type Tab,
} from '@livediagram/document';

type Body = Record<string, unknown>;

export function upgradeStoredTabKeepingRetired(body: Body): Body {
  try {
    const tab = body as unknown as Pick<Tab, 'theme' | 'backgroundColor' | 'patternColor' | 'elements'>;
    const schemed = dropCustomTheme(
      migrateRetiredTheme(migrateRetiredScheme(migrateWhiteboardKind(settleTabFields(tab)))),
    );
    if (!Array.isArray(schemed.elements)) return schemed;
    const elements = settleStacks(
      settleDiagramKeys(
        upgradeLegacyLinks(migrateStoredElements(schemed.elements)),
        tagColoursOf(body),
      ),
    );
    return elements === schemed.elements ? schemed : { ...schemed, elements };
  } catch {
    console.warn('[migration] tab-unreadable', {
      elements: Array.isArray(body.elements) ? body.elements.length : 0,
    });
    return body;
  }
}
