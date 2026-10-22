// Before an agent's Pages edit (docs/specs/024-agents/pages-for-agents.md "Which tab"): a
// locked tab is refused. Every tab is a Pages tab, so there is no mode to switch into.
import type { PagesRefusal } from '@livedocuments/api-schema';
import type { Tab } from '@livedocuments/document';

// Fresh ids, injectable so tests are deterministic.
export type PagesIds = { page?: () => string; flow?: () => string };

export function enterPages(tab: Tab): { refusal: PagesRefusal } | null {
  if (!tab.locked) return null;
  return {
    refusal: {
      code: 'tab_locked',
      message: 'That tab is locked: unlock it in the editor first.',
    },
  };
}
