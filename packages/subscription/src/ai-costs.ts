// What each AI operation costs in AI credits (liveworkspace/docs/specs/019-subscription/subscription.md "What an AI
// operation costs"): set by the most model work the operation can do, so it is known, and shown, before anyone starts
// it. The servers spend these amounts and every screen says them from here, so the two never disagree.

/** The operations that spend AI credits, and what each costs. */
export const AI_CREDIT_COSTS = {
  /** liveknowledge: a question on built-in AI, Draft a Page included (2,000 tokens written at most). */
  knowledgeAsk: 1,
  /** liveknowledge: one conflict check after an edit, whatever pairs it reads. */
  knowledgeConflictCheck: 1,
  /** liveknowledge: Describe to Set Up (4,000 tokens written at most; a second ask, when the first cannot be read,
   *  is free). */
  knowledgeSetup: 2,
  /** Automations: one run of a Summarise step (300 tokens written). */
  automationSummary: 1,
  /** Automations: Describe a Rule (1,500 tokens written). */
  automationRuleDraft: 1,
  /** liveplanner: Describe a Plan or Describe a Form (2,000 tokens written). */
  planDraft: 1,
  /** Ask AI in any app's Tools, on built-in AI (2,000 tokens written at most: built-in AI's own cap). Charged to the
   *  item's owner for an Editor or a Participant, to a Viewer themself (020-ask "AI credits"). */
  ask: 1,
  /** Send to Knowledge Base: one summary of the selected items (1,500 tokens written at most), paid as Ask's are and
   *  spent only once the model has answered (004-index send-to-knowledge.md "The summary"). */
  knowledgeSummary: 1,
  /** livedocuments: Describe a Page, a slide's layout picked then written or an article written (2,000 tokens written
   *  an ask at most, two asks at most), paid as Ask's are and spent only once the page's words are in hand
   *  (livedocuments/docs/specs/007-editor/describe-a-page.md). */
  pageDraft: 1,
} as const;

/** livediagram: notes read from a photo for one credit. A photo's notes are read six to a request, so 24 is four
 *  requests. */
export const PHOTO_NOTES_PER_CREDIT = 24;

/** What reading a photo's notes costs: one credit for every 24 notes or part of 24, one at least. */
export function photoReadCredits(notes: number): number {
  return Math.max(1, Math.ceil(Math.max(0, notes) / PHOTO_NOTES_PER_CREDIT));
}

/** "1 AI credit", "2 AI credits". */
export function aiCreditsWords(credits: number): string {
  return `${credits.toLocaleString('en')} AI credit${credits === 1 ? '' : 's'}`;
}

/** The quiet line before an operation: "Uses 2 AI credits". */
export const usesAiCredits = (credits: number): string => `Uses ${aiCreditsWords(credits)}`;
