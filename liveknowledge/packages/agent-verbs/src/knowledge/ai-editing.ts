// AI Editing as an agent is told it (docs/specs/030-knowledgebase/ai-editing.md "For agents"): the knowledgebase's
// level, whether an agent's rewrite takes a page's verification away, and one sentence of what this connection may do
// here, the lower of its scopes and the level. The MCP's get_context and the CLI's context answer the same fields.
import type { AgentScope, KnowledgeAiEditing } from '@liveknowledge/api-schema';
import { aiWriteReach } from '@liveknowledge/document';

export const AI_EDITING_VALUES = ['suggest', 'unverified', 'any'] as const;

export type AiEditingFields = {
  ai_editing: KnowledgeAiEditing;
  ai_edit_unverifies: boolean;
  ai_editing_allows: string;
};

/** An api from before the setting says nothing: it reads as the default, Suggest Edits Only. */
export function aiEditingFieldsOf(
  level: KnowledgeAiEditing | undefined,
  unverifies: boolean | undefined,
  scopes: readonly AgentScope[],
): AiEditingFields {
  const ai_editing = level ?? 'suggest';
  const ai_edit_unverifies = ai_editing === 'any' && unverifies === true;
  return {
    ai_editing,
    ai_edit_unverifies,
    ai_editing_allows: allowsSentence(ai_editing, ai_edit_unverifies, scopes),
  };
}

function allowsSentence(
  level: KnowledgeAiEditing,
  unverifies: boolean,
  scopes: readonly AgentScope[],
): string {
  const reach = aiWriteReach(level, scopes);
  const suggests = scopes.includes('suggest') || scopes.includes('write');
  if (reach === 'none') {
    if (!suggests)
      return 'This connection only reads here: it cannot change or suggest changes to pages.';
    return level === 'suggest'
      ? 'AI Editing is Suggest Edits Only: change a page with suggest_edit, for a person to accept. write_page is refused.'
      : 'This connection has no write scope: change a page with suggest_edit, for a person to accept.';
  }
  if (reach === 'unverified')
    return 'AI Editing is Edit Unverified Pages: write_page rewrites a never-verified page; for a verified or review-due page, use suggest_edit.';
  return unverifies
    ? 'AI Editing is Edit Any Page: write_page rewrites any page, and rewriting a verified or review-due page takes its verification away until a person verifies it again. Prefer suggest_edit where a person should check first.'
    : 'AI Editing is Edit Any Page: write_page rewrites any page, verified ones too, and they stay verified. Prefer suggest_edit where a person should check first.';
}

/** The level as one phrase of the CLI's context line. */
export const aiEditingLine = (
  f: Pick<AiEditingFields, 'ai_editing' | 'ai_edit_unverifies'>,
): string =>
  f.ai_editing === 'suggest'
    ? 'AI Editing: suggest edits only'
    : f.ai_editing === 'unverified'
      ? 'AI Editing: edit unverified pages'
      : `AI Editing: edit any page${f.ai_edit_unverifies ? ' (unverifies it)' : ''}`;
