// Where an Inbox row leads (one-explorer-contracts.md "Inbox"): the place it opens in its app, the target the host's
// verbs find it by, and the verbs the reading pane offers for it. Re-exported from InboxReader.
import type { InboxTarget, InboxVerb, ItemPlace } from '../../types';
import type { InboxEntry } from './sections';

/** Where a row opens in its app: an action's popover, a thread's comments, a card on the board that shows it (or by
 *  itself), a form's responses on their board (else the form). */
export function entryPlace(e: InboxEntry): ItemPlace {
  switch (e.kind) {
    case 'Card':
    case 'CardThread': {
      const card = e.row.card!;
      // A card's own thread row names the card by `card.id` and the thread by its element (one-explorer-contracts.md
      // "What an item pushes"); a row from before threads named the card by its element.
      const thread = e.kind === 'CardThread' && card.id ? e.row.elementId : null;
      return {
        tabId: card.board?.tabId ?? null,
        elementId: card.board?.elementId ?? null,
        cardId: card.id ?? e.row.elementId,
        ...(thread ? { threadId: thread } : {}),
      };
    }
    case 'Action':
      return { tabId: e.row.tabId, elementId: e.row.elementId, open: 'action' };
    case 'Thread':
      return { tabId: e.row.tabId, elementId: e.row.elementId, open: 'comments' };
    case 'FormResponses':
      return { tabId: e.row.boardTabId ?? e.row.tabId };
  }
}

/** The row as the host's verbs find it; null for a form, which has none. */
export function entryTarget(e: InboxEntry): InboxTarget | null {
  if (e.kind === 'FormResponses') return null;
  const r = e.row;
  return {
    kind: e.kind,
    app: r.app,
    itemId: r.itemId,
    tabId: r.tabId,
    elementId: r.elementId,
    actionId: e.kind === 'Action' || e.kind === 'Card' ? e.row.actionId : null,
    local: r.local === true,
  };
}

/** The verbs the pane offers for a row on this page: the host's say, kept to the ones that make sense for the
 *  row's kind (a thread replies and resolves, an action or a card is marked done). */
export function offeredVerbs(
  e: InboxEntry,
  offers: ((t: InboxTarget) => readonly InboxVerb[]) | undefined,
): InboxVerb[] {
  const target = entryTarget(e);
  if (!target || !offers) return [];
  const said = offers(target);
  const fits: readonly InboxVerb[] =
    e.kind === 'Thread' || e.kind === 'CardThread' ? ['reply', 'resolve'] : ['done'];
  return fits.filter((v) => said.includes(v));
}
