// Who may do what with a page's suggested edits (docs/specs/030-knowledgebase/insights.md "Share roles"): everyone
// who reads the page sees them; accepting and dismissing are an Editor's of the whole knowledgebase alone (never a
// Participant's, never through a link confined to one page, never in a knowledgebase kept Offline). Presentation
// only: the api is the rule.
import type { EditorCapabilities } from '@/lib/editor-capabilities';

export type SuggestionRights = { see: boolean; decide: boolean };

export function suggestionRights(input: {
  can: Pick<EditorCapabilities, 'manageKnowledgebase'>;
  isStructureReadOnly: boolean;
  offline: boolean;
}): SuggestionRights {
  return {
    see: !input.offline,
    decide: input.can.manageKnowledgebase && !input.isStructureReadOnly && !input.offline,
  };
}
