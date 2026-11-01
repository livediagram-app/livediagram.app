// livehuddle's stored-tab upgrades for the migration's splitter (docs/migration.md step 3, "Each tab is upgraded
// before it moves"): `migrateStoredTabKeepingRetired` (@livehuddle/document stored-tab.ts), every upgrade
// `migrateStoredTab` runs but without its Pages and Plan drops, so a former Pages or Plan tab keeps its pages,
// articles, boards and Plan-only elements for liveplanner, livedocuments and livedesign to read. The migrate tool
// uses the same function. A body the upgrades can't read (a malformed element) is handed back as it came, as
// migrateIncomingTab does.
import { migrateStoredTabKeepingRetired, type Tab } from '@livehuddle/document';

type Body = Record<string, unknown>;
type UpgradableTab = Pick<Tab, 'theme' | 'backgroundColor' | 'patternColor' | 'elements'>;

export function upgradeStoredTabKeepingRetired(body: Body): Body {
  try {
    return migrateStoredTabKeepingRetired(body as unknown as UpgradableTab);
  } catch {
    console.warn('[migration] tab-unreadable', {
      elements: Array.isArray(body.elements) ? body.elements.length : 0,
    });
    return body;
  }
}
