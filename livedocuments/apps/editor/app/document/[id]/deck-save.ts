import { isDocumentTrashedError } from '@/lib/document-trashed';
import { SAVE_FORBIDDEN_MESSAGE, SAVE_SIGNED_OUT_MESSAGE, saveFailureStatus } from './save-failure';

// The editor's deck save (docs/specs/012-collaboration/speaker-note-cards.md "Two people writing at once" and
// "Saving"): each save carries the deck it was built on, and a refused or failed save is said, never swallowed, since
// the speaker would go on writing cards that never leave the browser.

export const DECK_TOO_LARGE_MESSAGE = 'Speaker notes are too long to save. Shorten some cards.';
export const DECK_SAVE_FAILED_MESSAGE = 'Couldn’t save your speaker notes. Check your connection.';

/**
 * What a failed deck save says: a deck past the cap (alone, or merged with another person's cards) how to make it
 * fit, the rest what a tab's save says. Null for a document in the Trash: the autosave reports that, once.
 */
export function deckSaveFailureMessage(err: unknown): string | null {
  if (isDocumentTrashedError(err)) return null;
  switch (saveFailureStatus(err)) {
    case 'tooLarge':
      return DECK_TOO_LARGE_MESSAGE;
    case 'forbidden':
      return SAVE_FORBIDDEN_MESSAGE;
    case 'unauthenticated':
      return SAVE_SIGNED_OUT_MESSAGE;
    default:
      return DECK_SAVE_FAILED_MESSAGE;
  }
}

/**
 * Sends `serialised` with the deck it was built on (`baseRef`), which it then becomes, before any request goes. A
 * failed save puts the base back while nothing newer has moved it, so the next save is built on the deck last stored
 * and sends this one's cards again as this editor's, rather than letting the merge read them as removed elsewhere.
 */
export function sendDeckSave(
  baseRef: { current: string | null },
  serialised: string | null,
  send: (presentationBase: string | null) => Promise<void>,
  showError: (message: string) => void,
): void {
  const presentationBase = baseRef.current;
  baseRef.current = serialised;
  void send(presentationBase).catch((err: unknown) => {
    if (baseRef.current === serialised) baseRef.current = presentationBase;
    const message = deckSaveFailureMessage(err);
    if (message) showError(message);
  });
}
