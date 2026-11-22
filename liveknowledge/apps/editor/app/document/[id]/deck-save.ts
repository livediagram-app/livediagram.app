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

/** Sends one deck save, built on the deck it is given; resolves when the save has landed, rejects when it failed. */
export type DeckSend = (presentationBase: string | null) => Promise<void>;

export type DeckSaveQueue = {
  /** Saves `serialised`: at once when no save is in flight, else after it, on its outcome. `unload` goes at once. */
  save(serialised: string | null, send: DeckSend, opts?: { unload?: boolean }): void;
};

/**
 * Deck saves one at a time (speaker-note-cards.md "Saving"). `baseRef` holds the deck last **stored**: a save is built
 * on it and moves it on only once it lands, so a failed save leaves it where it was, and the next save sends the failed
 * one's cards again as this editor's rather than letting the merge read them as removed elsewhere. A save asked for
 * while one is in flight waits for it and is built on its outcome; only the newest waiting deck goes (each is whole).
 * An unload save cannot wait (the page is going): it goes at once on the deck last stored, which at worst sends the
 * in-flight save's cards again as this editor's.
 */
export function deckSaveQueue(
  baseRef: { current: string | null },
  showError: (message: string) => void,
): DeckSaveQueue {
  let inFlight = false;
  let waiting: { serialised: string | null; send: DeckSend } | null = null;
  const run = (serialised: string | null, send: DeckSend) => {
    inFlight = true;
    const builtOn = baseRef.current;
    void send(builtOn)
      .then(() => {
        // Unless a load moved the base meanwhile (another document opened): that one is the newer.
        if (baseRef.current === builtOn) baseRef.current = serialised;
      })
      .catch((err: unknown) => {
        const message = deckSaveFailureMessage(err);
        if (message) showError(message);
      })
      .finally(() => {
        inFlight = false;
        const next = waiting;
        waiting = null;
        if (next) run(next.serialised, next.send);
      });
  };
  return {
    save(serialised, send, opts = {}) {
      if (opts.unload) {
        void send(baseRef.current).catch(() => {});
        return;
      }
      if (inFlight) waiting = { serialised, send };
      else run(serialised, send);
    },
  };
}
