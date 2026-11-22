// A request to the Claude Messages API (`POST /v1/messages`), as Ask and the conflict check send it. Built by hand because the call is made with an injected `fetch` from a
// Worker (claude-client.ts); the shapes are the Messages API's own.
import { claudeModel } from './claude-models';
import type { ModelEffort, ModelMessage } from './model-request';

export const CLAUDE_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
export const CLAUDE_API_VERSION = '2026-10-21';
/** The beta that lets a request name `fallbacks: "default"`. */
export const CLAUDE_FALLBACK_BETA = 'server-side-fallback-2026-07-01';

export type ClaudeEffort = ModelEffort;
export type ClaudeMessage = ModelMessage;

/** The body of a Messages request. No `thinking` (every listed model thinks adaptively when it is left out, and
 *  some reject any other setting) and no sampling parameters (the current models reject them). */
export type ClaudeRequest = {
  model: string;
  max_tokens: number;
  stream: true;
  system: string;
  messages: ClaudeMessage[];
  output_config: { effort: ClaudeEffort };
  /** On a policy decline, the API answers on the model it picks for the decline's category. */
  fallbacks?: 'default';
};

/** A streamed request to `model` (a stored setting: an unknown id reads as the default model). */
export function claudeRequest(options: {
  model: unknown;
  system: string;
  messages: ClaudeMessage[];
  maxTokens: number;
  effort: ClaudeEffort;
}): ClaudeRequest {
  const model = claudeModel(options.model);
  return {
    model: model.id,
    max_tokens: options.maxTokens,
    stream: true,
    system: options.system,
    messages: options.messages,
    output_config: { effort: options.effort },
    ...(model.fallbacks ? { fallbacks: 'default' as const } : {}),
  };
}
