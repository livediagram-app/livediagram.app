// Who may do what in Ask and Insights (docs/specs/030-knowledgebase/search-and-ask.md "Share roles",
// insights.md "Share roles"). Asking is every signed-in role's; making pages from an answer or a gap, dismissals,
// Always in Context and the owners' emails are a writer's (an Editor or a Participant), on the whole knowledgebase;
// the key, the model and an agent's write are an Editor's alone. Presentation only: the api is the rule.
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
  /** Dismiss a question or a conflict. */
  resolve: boolean;
  /** Accept or dismiss a suggested edit: an Editor of the whole knowledgebase's alone (insights.md "Share
   *  roles", Work Tracker 1362). */
  acceptSuggestions: boolean;
  /** Add a page to Always in Context, or take one out. */
  context: boolean;
  /** Allow a connected agent to write here, or stop it. */
  grantAgents: boolean;
  /** Ask a conflict's owners, or remind the owners: a signed-in Editor's (the api refuses a guest). */
  emailOwners: boolean;
};

export function askRights(input: {
  can: Pick<EditorCapabilities, 'editPages' | 'manageKnowledgebase'>;
  isStructureReadOnly: boolean;
  accountUserId: string | null | undefined;
  offline: boolean;
}): AskRights {
  const whole = !input.isStructureReadOnly && !input.offline;
  const writer = input.can.editPages && whole;
  const manager = input.can.manageKnowledgebase && whole;
  return {
    askOff: input.offline ? 'offline' : input.accountUserId ? null : 'signed-out',
    manageAi: manager,
    makePages: writer,
    resolve: writer,
    acceptSuggestions: manager,
    context: writer,
    grantAgents: manager,
    emailOwners: writer && !!input.accountUserId,
  };
}
