// The `X-Save-Changes` header of a tab save (docs/specs/012-collaboration/collab-race-hardening.md "A save is merged
// with the stored tab"): the save's changes by id, so the api merges them over the tab it has stored. Built by the
// editor's save and read by the api's tab PUT, so both agree on the encoding.
import {
  TAB_SAVE_CHANGES_HEADER,
  decodeTabSaveChanges,
  encodeTabSaveChanges,
} from '@liveworkspace/api-schema/tab-save-changes';
import {
  parseTabSaveChanges,
  tabSaveChanges,
  wholeArticleChanges,
  type Tab,
  type TabSaveChanges,
} from '@livedocuments/document';

export { TAB_SAVE_CHANGES_HEADER };

/** The header value for a save from `before` (the save baseline) to `after`; null for a tab the baseline lacks (its
 *  first save is stored as sent) or changes too big for a header even with every article taken whole. */
export function tabSaveChangesHeader(
  before: Tab | undefined,
  after: Tab,
  previous?: Tab,
): string | null {
  if (!before) return null;
  const changes = tabSaveChanges(before, after, previous);
  return encodeTabSaveChanges(changes) ?? encodeTabSaveChanges(wholeArticleChanges(changes));
}

/** The changes a request's header names, or null (absent or unreadable: the tab is stored as sent). */
export function readTabSaveChanges(header: string | null): TabSaveChanges | null {
  return parseTabSaveChanges(decodeTabSaveChanges(header));
}
