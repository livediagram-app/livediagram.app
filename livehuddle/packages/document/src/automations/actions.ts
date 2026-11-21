// livehuddle's own step (docs/specs/013-workspace/automations.md "Steps of its own"; blueprint automations.md
// "Kinds"): Clear the Suggestion Box, beside the ones every app has (Add a Tab from a Template is the shared step).
// What it does when a rule runs is the room's (apps/api document-room/automations/kit-suggestions.ts). Pure.

import { defineAction, type ActionKind, type ItemPart } from '@liveworkspace/automations/item';

export const CLEAR_SUGGESTIONS_STEP = 'clear_suggestions';

export type ClearSuggestionsStep = { kind: typeof CLEAR_SUGGESTIONS_STEP };

// Every note in every Suggestion Box of the Space: the step names no box.
const clearSuggestions = defineAction<ClearSuggestionsStep & ItemPart>({
  kind: CLEAR_SUGGESTIONS_STEP,
  name: 'Clear the Suggestion Box',
  group: 'Space',
  line: 'deletes every note in the Space’s Suggestion Boxes',
  format:
    '{"kind":"clear_suggestions"} (deletes every note in every Suggestion Box of the Space, for good; an empty ' +
    'box is not a failure)',
  read: () => ({ kind: CLEAR_SUGGESTIONS_STEP }),
  defaults: () => ({ kind: CLEAR_SUGGESTIONS_STEP }),
  words: () => [{ chip: 'Clear the Suggestion Box' }],
  would: () => 'Would clear every note in the Suggestion Box',
});

/** livehuddle's own steps, in the picker's order. */
export const SPACE_ACTIONS: readonly ActionKind[] = [clearSuggestions];
