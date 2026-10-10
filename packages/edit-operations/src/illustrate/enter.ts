// Before an agent's Illustrate edit (docs/specs/024-agents/illustrate-for-agents.md "Which tab"): a
// locked tab or an Event Storming board is refused; a tab in another mode is switched into
// Illustrate by the same edit, as the editor's mode switch does.
import type { IllustrateRefusal } from '@livediagram/api-schema';
import { opensInOf, tabKindOf, withEditorModeSwitched, type Tab } from '@livediagram/document';

// Fresh ids, injectable so tests are deterministic.
export type IllustrateIds = { page?: () => string; flow?: () => string };

export function enterIllustrate(
  tab: Tab,
): { tab: Tab; switched: boolean } | { refusal: IllustrateRefusal } {
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
  if (opensInOf(tab) === 'illustrate') return { tab, switched: false };
  return { tab: withEditorModeSwitched(tab, 'illustrate').tab, switched: true };
}
