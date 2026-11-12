// The `X-Save-Changes` header of a tab save (docs/specs/012-collaboration/collab-race-hardening.md "A save is merged
// with the stored tab"): the save's page steps, so the api merges them over the tab it has stored. Built by the
// editor's save and read by the api's tab PUT, so both agree on the encoding.
import {
  TAB_SAVE_CHANGES_HEADER,
  decodeTabSaveChanges,
  encodeTabSaveChanges,
} from '@liveworkspace/api-schema/tab-save-changes';
import {
  parseTabSaveChanges,
  tabSaveChanges,
  type Tab,
  type TabSaveChanges,
} from '@livedesign/design';

export { TAB_SAVE_CHANGES_HEADER };

/** The header value for a save from `before` (the save baseline) to `after`; null for a tab the baseline lacks (its
 *  first save is stored as sent) or steps too many for a header. */
export function tabSaveChangesHeader(
  before: Tab | undefined,
  after: Tab,
  previous?: Tab,
): string | null {
  return before ? encodeTabSaveChanges(tabSaveChanges(before, after, previous)) : null;
}

/** The changes a request's header names, or null (absent or unreadable: the tab is stored as sent). */
export function readTabSaveChanges(header: string | null): TabSaveChanges | null {
  return parseTabSaveChanges(decodeTabSaveChanges(header));
}
