// What Ask, the conflict check and Describe to Set Up ask of a model, before any provider's own request shape
// (liveknowledge/docs/specs/030-knowledgebase/search-and-ask.md "Providers"): the prompts, the fenced material and the reply's
// form are the same whichever provider answers. claude-request.ts and openai-request.ts write it out for each API.

export type ModelEffort = 'low' | 'medium' | 'high';
export type ModelMessage = { role: 'user' | 'assistant'; content: string };

export type ModelRequest = {
  system: string;
  messages: ModelMessage[];
  /** The ceiling on what the model may write, its thinking included. */
  maxTokens: number;
  effort: ModelEffort;
};

/** Untrusted text made safe to put inside a fence: the characters that could close a tag or open one are written
 *  as entities, so no writing and no question can end its own fence or start another. */
export const fenced = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
