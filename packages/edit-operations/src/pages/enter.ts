// Before an agent's Pages edit (docs/specs/024-agents/pages-for-agents.md "Which tab"): a
// locked tab is refused; a tab in another mode is switched into
// Pages by the same edit, as the editor's mode switch does.
import type { PagesRefusal } from '@liveplanner/api-schema';
import { opensInOf, withEditorModeSwitched, type Tab } from '@liveplanner/document';

// Fresh ids, injectable so tests are deterministic.
export type PagesIds = { page?: () => string; flow?: () => string };

export function enterPages(tab: Tab): { tab: Tab; switched: boolean } | { refusal: PagesRefusal } {
  if (tab.locked)
    return {
      refusal: {
        code: 'tab_locked',
        message: 'That tab is locked: unlock it in the editor first.',
      },
    };
  if (opensInOf(tab) === 'pages') return { tab, switched: false };
  return { tab: withEditorModeSwitched(tab, 'pages').tab, switched: true };
}
