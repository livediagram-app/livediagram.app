// How far an agent may change a page itself (docs/specs/030-knowledgebase/ai-editing.md, docs/specs/024-agents/
// knowledgebase-for-agents.md `write_page`): the knowledgebase's AI Editing over every write made with an API token.
// The token's scopes have already decided whether it writes at all (gateWrite); this narrows it further, never widens.
//   suggest     every token write of a page is refused: the agent suggests the change for a person to accept
//   unverified  a rewrite (an article write, a version restore) of a Verified or Review Due page is refused
//   any         every write the scopes allow
import {
  aiEditingOf,
  parseKnowledgeFields,
  trustState,
  verificationOn,
  type AiEditing,
} from '@liveknowledge/knowledge';
import { json } from '../responses';
import type { DocumentDTO } from '../types';

/** `rewrite` replaces a page's writing (an article write, a version restore); `other` is every other token write of
 *  a page (a cover alone, the Pages route's page changes, a changeset). */
export type AgentWriteKind = 'rewrite' | 'other';

const SUGGEST_INSTEAD = 'Suggest the change instead with suggest_edit, for a person to accept.';

const LEVEL_NAME: Record<AiEditing, string> = {
  suggest: 'Suggest Edits Only',
  unverified: 'Edit Unverified Pages',
  any: 'Edit Any Page',
};

const refused = (
  document: DocumentDTO,
  tabId: string,
  level: AiEditing,
  code: string,
  message: string,
  extra: object = {},
): Response => {
  console.info('[pages-agent] refused', { documentId: document.id, tabId, code, level, ...extra });
  return json({ error: code, message }, { status: 409 });
};

/** The refusal an agent's write meets under the knowledgebase's AI Editing, or null when it may go ahead. */
export function agentWriteRefusal(
  document: DocumentDTO,
  tabId: string,
  kind: AgentWriteKind,
): Response | null {
  const level = aiEditingOf(document.knowledgeSettings);
  if (level === 'suggest')
    return refused(
      document,
      tabId,
      level,
      'ai_editing_suggest_only',
      `This knowledgebase's AI Editing setting is ${LEVEL_NAME.suggest}, so agents do not change pages directly. ${SUGGEST_INSTEAD}`,
    );
  if (level === 'any' || kind === 'other') return null;
  const fields = parseKnowledgeFields(document.tabs.find((t) => t.id === tabId)?.knowledge);
  const state = trustState(fields, document.knowledgeSettings.reviewEvery, Date.now()).state;
  if (state === 'never-verified') return null;
  const code = state === 'verified' ? 'page_verified' : 'page_review_due';
  // Verification off (a Review Period of Never): a person still vouched for it, and the agent was told `off`.
  const off = !verificationOn(document.knowledgeSettings.reviewEvery);
  const setting = `this knowledgebase's AI Editing setting is ${LEVEL_NAME.unverified}`;
  return refused(
    document,
    tabId,
    level,
    code,
    off
      ? `A person verified this page before verification was turned off, and ${setting}, so an agent does not rewrite it. ${SUGGEST_INSTEAD}`
      : state === 'verified'
        ? `This page is verified, and ${setting}, so an agent does not rewrite it. ${SUGGEST_INSTEAD}`
        : `This page is due for review, and ${setting}, so an agent does not rewrite it until a person has looked at it. ${SUGGEST_INSTEAD}`,
    { off },
  );
}
