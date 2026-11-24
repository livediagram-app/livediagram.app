// AI Editing's words (docs/specs/030-knowledgebase/ai-editing.md "What it is", "The dialog"): one place, so the
// dialog, its tests and the help article say the same.
import type { AiEditing } from '@liveknowledge/knowledge';

export type AiEditingLevelWords = { id: AiEditing; label: string; about: string };

export const AI_EDITING_LEVELS_WORDS: readonly AiEditingLevelWords[] = [
  {
    id: 'suggest',
    label: 'Suggest Edits Only',
    about:
      'Agents suggest changes for a person to accept. No page changes until someone accepts it.',
  },
  {
    id: 'unverified',
    label: 'Edit Unverified Pages',
    about:
      'Agents rewrite pages nobody has verified. Verified and Review Due pages take suggestions.',
  },
  {
    id: 'any',
    label: 'Edit Any Page',
    about: 'Agents rewrite any page, verified ones too. Every change is marked AI Edited.',
  },
];

export const AI_EDITING_TITLE = 'AI Editing';
export const AI_EDITING_SUBTITLE =
  'How far agents connected over MCP, the CLI or the API may change pages.';
export const DEFAULT_PILL = 'Default';
export const UNVERIFY_LABEL = 'Remove Verification When AI Edits';
export const UNVERIFY_ABOUT =
  'A verified page an agent rewrites goes back to Not Verified, for a person to check and verify again.';
export const ALLOW_WRITING_NOTE =
  'A connection also needs Allow Writing, from its card in Insights. Without it, an agent only suggests.';
export const SAVE_FAILED = 'AI Editing could not be saved. Check your connection and try again.';
export const SAVE_REFUSED = 'Only an Editor of this knowledgebase can change AI Editing.';
