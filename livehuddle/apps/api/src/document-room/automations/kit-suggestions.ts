// Clear the Suggestion Box (docs/specs/013-workspace/automations.md "Steps of its own"; blueprint automations.md "The
// kit": run): every note in every Suggestion Box of the Space, gone for good, as an Editor's Remove takes one. The
// notes are kept beside the content (db/suggestions.ts), so no tab, snapshot or version changes and nothing a rule
// hears is written. An Editor's open box shows it on its next Refresh, as it shows a drop.
import { CLEAR_SUGGESTIONS_STEP } from '@livehuddle/document/automations';
import type { ItemActionRunner } from '@liveworkspace/automations/room';
import { clearSuggestions } from '../../db/suggestions';
import type { DocumentEnv } from '../../types';

const notes = (n: number) => `${n} note${n === 1 ? '' : 's'}`;

/** livehuddle's own step runners, by kind. */
export function suggestionRunners(
  env: DocumentEnv,
  documentId: string,
): Record<string, ItemActionRunner> {
  return {
    [CLEAR_SUGGESTIONS_STEP]: async () => {
      const cleared = await clearSuggestions(env, documentId);
      console.info('[automations] suggestions cleared', { documentId, count: cleared });
      return {
        ok: true,
        text:
          cleared === 0
            ? 'The Suggestion Box was already empty'
            : `Cleared ${notes(cleared)} from the Suggestion Box`,
      };
    },
  };
}
