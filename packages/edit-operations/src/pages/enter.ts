// Before an agent's Pages edit (docs/specs/024-agents/pages-for-agents.md "Which tab"): a
// locked tab or an Event Storming board is refused; a tab in another mode is switched into
// Pages by the same edit, as the editor's mode switch does.
import type { PagesRefusal } from '@liveplanner/api-schema';
import { opensInOf, tabKindOf, withEditorModeSwitched, type Tab } from '@liveplanner/document';

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
  if (tabKindOf(tab) === 'event-storming')
    return {
      refusal: {
        code: 'tab_kind',
        message: 'An Event Storming board has no pages. Add a tab (add_tab) to make pages on.',
      },
    };
  if (opensInOf(tab) === 'pages') return { tab, switched: false };
  return { tab: withEditorModeSwitched(tab, 'pages').tab, switched: true };
}
