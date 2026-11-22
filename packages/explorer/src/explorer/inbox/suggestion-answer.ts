// Whether a suggested edit's Accept and Dismiss are offered on this page, for the Inbox's reading pane to know before
// its parts (./SuggestionPane) load: those stay off the Explorer's first load
// (liveworkspace/docs/specs/010-site/blueprints/site.md "Performance and limits").

import type { InboxActions } from '../../types';
import { entryTarget } from './inbox-entry-place';
import type { InboxEntry } from './sections';

/** Accept and Dismiss are offered for this row: the host's actions carry both out for it. */
export function suggestionOffered(entry: InboxEntry, actions: InboxActions | undefined): boolean {
  const target = entry.kind === 'Suggestion' ? entryTarget(entry) : null;
  const said = target && actions ? actions.offers(target) : [];
  return (
    target !== null &&
    said.includes('accept') &&
    said.includes('dismiss') &&
    Boolean(actions?.accept && actions?.dismiss)
  );
}
