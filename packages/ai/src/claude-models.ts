// The Claude models a team may choose in Settings > AI (liveknowledge/docs/specs/030-knowledgebase/search-and-ask.md "Model"):
// the current generation of each line, as Anthropic's model table listed them on 2026-11-03. The ids are complete
// as written; none takes a date suffix.

export type ClaudeModel = {
  id: string;
  name: string;
  /** Whether a request to the model carries the server-side `fallbacks` parameter, which answers on another model
   *  when a safety classifier declines the request (claude-request.ts). Off for every model: a fallback bills the
   *  team's own key at another model's rate, and a team must be able to predict what a question costs. A declined
   *  request is the failure kind `refused` instead. (Claude Haiku 5.5 rejects the parameter in any case.) */
  fallbacks: boolean;
};

export const CLAUDE_MODELS: readonly ClaudeModel[] = [
  { id: 'claude-fable-5-2', name: 'Claude Fable 5.2', fallbacks: false },
  { id: 'claude-opus-5-5', name: 'Claude Opus 5.5', fallbacks: false },
  { id: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5', fallbacks: false },
  { id: 'claude-haiku-5-5', name: 'Claude Haiku 5.5', fallbacks: false },
];

export const DEFAULT_CLAUDE_MODEL = 'claude-fable-5-2';

/** The model a stored setting names, or the default when it names none of the list (a model since retired, or
 *  nothing). */
export function claudeModel(id: unknown): ClaudeModel {
  return CLAUDE_MODELS.find((m) => m.id === id) ?? CLAUDE_MODELS[0]!;
}
