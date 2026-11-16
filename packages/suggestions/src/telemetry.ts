// The telemetry types suggestions send (liveworkspace/docs/specs/015-suggestions/canvas-suggestions.md
// "Telemetry"), written down once so the products' telemetry dashboards read them from here and cannot drift.

/** `Element·Changed`, from the canvas's mode switch, a suggestion made, and the review's decisions. */
export const CANVAS_SUGGESTION_TYPES = [
  'CanvasSuggesting',
  'CanvasEditing',
  'CanvasSuggestionMade',
  'CanvasSuggestionSuggestOnly',
  'CanvasSuggestionAccepted',
  'CanvasSuggestionsAcceptedAll',
  'CanvasSuggestionRejected',
  'CanvasSuggestionsRejectedAll',
] as const;

export type CanvasSuggestionType = (typeof CANVAS_SUGGESTION_TYPES)[number];

/** `<Item>·Shared`, from the Share dialog's Suggestions section. Assistants Suggest is the article editor's alone. */
export const SUGGEST_ONLY_SHARE_TYPES = [
  'SuggestOnlyLinkOn',
  'SuggestOnlyLinkOff',
  'SuggestOnlyPersonOn',
  'SuggestOnlyPersonOff',
] as const;

export const ASSISTANTS_SUGGEST_SHARE_TYPES = [
  'AssistantsSuggestOn',
  'AssistantsSuggestOff',
] as const;
