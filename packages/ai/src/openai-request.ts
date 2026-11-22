// A request to the OpenAI Responses API (`POST /v1/responses`), the API OpenAI recommends for text generation
// ("Responses is recommended for all new projects", https://developers.openai.com/api/docs/guides/migrate-to-responses,
// read 2026-11-20). Built by hand for the same reason the Claude request is: the call is made with an injected
// `fetch` from a Worker (openai-client.ts).
import type { ModelMessage, ModelPart, ModelRequest } from './model-request';
import { openAiModel } from './openai-models';

export const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';

/** The body of a Responses request. `instructions` is the system prompt; `input` the conversation.
 *  `max_output_tokens` bounds reasoning and visible tokens together. `store: false`: OpenAI keeps responses by
 *  default, and a team's passages are not left on another service longer than the call needs. */
/** A content part of the Responses API's input: text, or an image as a data URL. */
export type OpenAiPart =
  | { type: 'input_text'; text: string }
  | { type: 'input_image'; image_url: string };
export type OpenAiInput = { role: 'user' | 'assistant'; content: string | OpenAiPart[] };

const openAiPart = (part: ModelPart): OpenAiPart =>
  part.type === 'text'
    ? { type: 'input_text', text: part.text }
    : { type: 'input_image', image_url: `data:${part.mediaType};base64,${part.data}` };

/** A provider-neutral message in the Responses API's shape. */
export const openAiInput = ({ role, content }: ModelMessage): OpenAiInput => ({
  role,
  content: typeof content === 'string' ? content : content.map(openAiPart),
});

export type OpenAiRequest = {
  model: string;
  instructions: string;
  input: OpenAiInput[];
  max_output_tokens: number;
  stream: true;
  store: false;
  reasoning: { effort: 'low' | 'medium' | 'high' };
};

/** A streamed request to `model` (a stored setting: an unknown id reads as the default model). */
export function openAiRequest(model: unknown, request: ModelRequest): OpenAiRequest {
  return {
    model: openAiModel(model).id,
    instructions: request.system,
    input: request.messages.map(openAiInput),
    max_output_tokens: request.maxTokens,
    stream: true,
    store: false,
    reasoning: { effort: request.effort },
  };
}
