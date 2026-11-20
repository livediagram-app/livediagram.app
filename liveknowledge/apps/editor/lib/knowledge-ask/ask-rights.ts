// Who may do what in Ask and AI Knowledge (docs/specs/030-knowledgebase/search-and-ask.md "Share roles",
// ai-knowledge.md "Share roles"). Asking is every signed-in role's; the key, the model, making pages from an answer
// or a gap, dismissals and Always in Context are an Editor's, on the whole knowledgebase. Presentation only: the api
// is the rule.
import type { EditorCapabilities } from '@/lib/editor-capabilities';

/** Why this session cannot ask, whatever the key: the knowledgebase is kept in this browser, or nobody is signed
 *  in (Ask would spend the team's key for a stranger). */
export type AskOff = 'offline' | 'signed-out';

export type AskRights = {
  askOff: AskOff | null;
  /** Add, replace or remove the key; choose the model. */
  manageAi: boolean;
  /** Save an answer as a page; draft a page from a gap or an unanswered question. */
  makePages: boolean;
  /** Dismiss a question, a conflict or a suggestion; accept a suggestion. */
  resolve: boolean;
  /** Add a page to Always in Context, or take one out. */
  context: boolean;
  /** Allow a connected agent to write here, or stop it. */
  grantAgents: boolean;
};

export function askRights(input: {
  can: Pick<EditorCapabilities, 'editPages'>;
  isStructureReadOnly: boolean;
  accountUserId: string | null | undefined;
  offline: boolean;
}): AskRights {
  const editor = input.can.editPages && !input.isStructureReadOnly && !input.offline;
  return {
    askOff: input.offline ? 'offline' : input.accountUserId ? null : 'signed-out',
    manageAi: editor,
    makePages: editor,
    resolve: editor,
    context: editor,
    grantAgents: editor,
  };
}
