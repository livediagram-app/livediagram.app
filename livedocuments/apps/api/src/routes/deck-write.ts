// The slide deck a document PUT carries (docs/specs/015-api/api.md, docs/specs/012-collaboration/speaker-note-cards.md
// "Two people writing at once" and "Saving"), read and checked before anything is written: none, a deck written as
// sent, a deck merged against what it was built on, or only the changed slides. A deck past the deck cap, a patch past
// it or a base past MAX_DECK_BASE_LEN is 413, as a tab past its cap is.
import { parseDeckSlidePatch, type DeckSlidePatch } from '@livedocuments/document';
import { MAX_DECK_BASE_LEN, MAX_DECK_LEN } from '../limits';
import { badRequest, payloadTooLarge } from '../responses';

export type DeckWriteRequest =
  | { kind: 'none' }
  | { kind: 'set'; presentation: string | null }
  | { kind: 'merge'; presentation: string; base: string | null }
  | { kind: 'patch'; patch: DeckSlidePatch };

export function readDeckWrite(body: {
  presentation?: unknown;
  presentationBase?: unknown;
  presentationPatch?: unknown;
}): DeckWriteRequest | Response {
  const { presentation, presentationBase: base, presentationPatch } = body;
  if (presentationPatch !== undefined) {
    if (presentation !== undefined) return badRequest('presentation and presentationPatch');
    if (JSON.stringify(presentationPatch).length > MAX_DECK_LEN) return payloadTooLarge();
    const patch = parseDeckSlidePatch(presentationPatch);
    return patch ? { kind: 'patch', patch } : badRequest('invalid presentationPatch');
  }
  if (presentation === undefined) return { kind: 'none' };
  if (presentation !== null && typeof presentation !== 'string') {
    return badRequest('invalid presentation');
  }
  if (presentation !== null && presentation.length > MAX_DECK_LEN) return payloadTooLarge();
  if (base !== undefined && base !== null && typeof base !== 'string') {
    return badRequest('invalid presentationBase');
  }
  if (typeof base === 'string' && base.length > MAX_DECK_BASE_LEN) return payloadTooLarge();
  if (presentation === null || base === undefined) return { kind: 'set', presentation };
  return { kind: 'merge', presentation, base };
}
