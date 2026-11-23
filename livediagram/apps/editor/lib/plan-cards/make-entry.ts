// Make Plan Cards' entries (docs/specs/013-workspace/make-plan-cards.md "Where"): the selection toolbar and the tab
// menu ask, and the editor's one PlanCardsHost opens the preview. A module-level relay, as Send to Plan's: the
// toolbar, the tab menu and the host sit far apart in the tree, and one editor runs per page.
import { canSendHere } from '@liveworkspace/workbench/components/send-to-plan/send-to-plan-entry';

/** What to read: the selection's elements, or the whole tab (null). */
export type MakeAsk = { only: readonly string[] | null };

const listeners = new Set<(ask: MakeAsk) => void>();

export function openMakePlanCards(ask: MakeAsk): void {
  for (const l of [...listeners]) l(ask);
}

/** The host's subscription; answers the unsubscribe. */
export function onMakePlanCards(listener: (ask: MakeAsk) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Whether this session may make cards: the same sessions that may Send to Plan, while a host listens. */
export function canMakePlanCards(): boolean {
  return listeners.size > 0 && canSendHere();
}
