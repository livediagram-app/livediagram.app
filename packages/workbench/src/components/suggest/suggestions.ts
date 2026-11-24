// The suggestions (liveworkspace/docs/specs/016-notifications/suggestions.md): each one's words, the app that offers
// it and its telemetry type, and the rules' numbers. Pure data; each app's trigger is its own
// (<app>/docs/specs/013-workspace/suggestions.md).

export type SuggestionId =
  'make-plan' | 'write-up' | 'add-to-knowledgebase' | 'bring-in' | 'send-to-plan';

export type Suggestion = {
  // What it would do, the callout's title.
  title: string;
  // The one click's words.
  action: string;
  // Its telemetry type (`UI·Opened|Used|Closed·<type>`), never the item or its words.
  type: string;
};

export const SUGGESTIONS: Readonly<Record<SuggestionId, Suggestion>> = {
  'make-plan': { title: 'Make These a Plan', action: 'Send to Plan', type: 'SuggestMakePlan' },
  'write-up': { title: 'Write It Up', action: 'Write Page', type: 'SuggestWriteUp' },
  'add-to-knowledgebase': {
    title: 'Add to Knowledgebase',
    action: 'Add Page',
    type: 'SuggestAddToKnowledgebase',
  },
  'bring-in': {
    title: 'Bring In Your Diagrams and Docs',
    action: 'Connect Them',
    type: 'SuggestBringIn',
  },
  'send-to-plan': { title: 'Send to a Plan', action: 'Send to Plan', type: 'SuggestSendToPlan' },
};

/** Quiet after a key, a pointer or a press before a suggestion may appear ("Never mid-gesture"). */
export const SUGGEST_IDLE_MS = 1_500;
/** How often a trigger is checked while the item is open, visible and nothing was decided for it ("Cheap"). */
export const SUGGEST_CHECK_MS = 5_000;
/** Item decisions this browser keeps, newest first; older ones may suggest again. */
export const SUGGEST_DECIDED_MAX = 300;
/** The shared Settings key of the one switch (the `all` scope); anything but false is on. */
export const SUGGEST_SETTING = 'suggestNextApp';
