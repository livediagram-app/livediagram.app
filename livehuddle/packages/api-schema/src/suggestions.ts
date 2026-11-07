// A Suggestion Box's notes on the wire (docs/specs/009-elements/team-pieces.md "Suggestion Box", "The wire"): what an
// Editor reads. A note is its text and the UTC day it was dropped, and nothing about who dropped it.

/** One note in a Suggestion Box. */
export type Suggestion = { id: string; text: string; day: string };

/** `GET /api/documents/:id/tabs/:tabId/suggestions?elementId=`: the box's notes, newest first. */
export type SuggestionsResponse = { suggestions: Suggestion[] };

/** Why a drop was refused, beyond the usual 400, 403 and 404. */
export type SuggestionRefusal = 'box_full';
