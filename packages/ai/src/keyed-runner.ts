// A Workers AI shaped `run` that answers on a person's key instead (liveworkspace/docs/specs/003-accounts/blueprints/
// ai-keys.md "The apps' model calls"): the drafts (Describe a Plan, a Form, a Rule) already build a Workers AI request
// and read its `{ response }`, so on a key the same request goes through `callModel` and comes back in that shape,
// and every reader stays as it is. A failure throws the provider's ModelCallError, whose words hold no key.
import type { ModelEffort, ModelMessage, ModelRequest } from './model-request';
import { callModel } from './model-providers';
import type { KeyCaller } from './own-key';

/** The Workers AI chat request the drafts send, as far as a key's call reads it. */
export type WorkersAiAsk = {
  messages?: readonly { role: string; content: unknown }[];
  response_format?: { type: string; json_schema?: { schema?: unknown } };
  max_tokens?: number;
};

/** The least a keyed ask may write: the providers' models think before they answer, and the thinking counts. */
export const KEYED_MIN_TOKENS = 4000;

const asText = (content: unknown): string =>
  typeof content === 'string' ? content : content == null ? '' : JSON.stringify(content);

/** The Workers AI request as a provider-neutral one: its system messages are the instructions, a JSON schema is
 *  said in words after them (the providers' own JSON modes differ), the rest is the conversation. */
export function keyedRequest(ask: WorkersAiAsk, effort: ModelEffort = 'low'): ModelRequest {
  const messages = ask.messages ?? [];
  const system = messages
    .filter((m) => m.role === 'system')
    .map((m) => asText(m.content))
    .join('\n\n');
  const schema = ask.response_format?.json_schema?.schema;
  const form =
    schema !== undefined
      ? `\n\nReply with one JSON object only, no prose and no code fence, matching this JSON Schema:\n${JSON.stringify(schema)}`
      : ask.response_format?.type === 'json_object'
        ? '\n\nReply with one JSON object only, no prose and no code fence.'
        : '';
  const conversation: ModelMessage[] = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: asText(m.content),
    }));
  return {
    system: system + form,
    messages: conversation,
    maxTokens: Math.max(KEYED_MIN_TOKENS, (ask.max_tokens ?? 0) * 2),
    effort,
  };
}

/** The `run` a draft asks through, on `caller`'s key: the model it names is the binding's and is not used. */
export function keyedRunner(caller: KeyCaller): {
  run(model: string, input: object, options?: object): Promise<{ response: string }>;
} {
  return {
    async run(_model, input) {
      const reply = await callModel({ ...caller, request: keyedRequest(input as WorkersAiAsk) });
      return { response: reply.text };
    },
  };
}
