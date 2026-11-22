// The one call to built-in AI (liveknowledge/docs/specs/030-knowledgebase/search-and-ask.md "Built-in AI"; owner, 2026-11-21):
// Cloudflare Workers AI through the api's `AI` binding, asked with the same provider-neutral request Ask and the
// conflict check hand the providers' clients, and streamed. The binding is handed in: nothing here reads an
// environment or logs. A failure is a ModelCallError of provider `built-in`, whose words never hold the binding's.
//
// The binding answers a streamed ask with a server-sent event stream whose payloads are `{ response }` pieces (the
// text-generation shape) or chat-completion chunks (`choices[0].delta.content`), then `[DONE]`; an ask it does not
// stream answers one object (`builtInReplyText`). Both are read.
import { ModelCallError } from './model-failure';
import { messageText, type ModelRequest } from './model-request';
import { eventData, parseEvent } from './sse';

/** The model built-in AI answers with: liveplanner's Describe a Plan model, its thinking turned off. */
export const BUILT_IN_MODEL = '@cf/google/gemma-4-26b-a4b-it';
/** The most one built-in call may write: answers are short, and liveknowledge pays for every token. */
export const BUILT_IN_MAX_TOKENS = 2000;
/** How long one built-in call may take before it is given up. */
export const BUILT_IN_TIMEOUT_MS = 60_000;

/** The `AI` binding, as far as a call needs it. */
export type BuiltInAiBinding = {
  run(model: string, input: object, options?: object): Promise<unknown>;
};

/** What the binding's `run` is handed for a streamed call. */
export type BuiltInInput = {
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  max_tokens: number;
  temperature: number;
  stream: true;
  chat_template_kwargs: { enable_thinking: false };
};

/** The request in Workers AI's chat shape: the system prompt first, then the conversation, the ceiling lowered to
 *  built-in AI's own. */
export function builtInInput(request: ModelRequest): BuiltInInput {
  return {
    messages: [
      { role: 'system', content: request.system },
      ...request.messages.map(({ role, content }) => ({ role, content: messageText(content) })),
    ],
    max_tokens: Math.min(request.maxTokens, BUILT_IN_MAX_TOKENS),
    temperature: 0.2,
    stream: true,
    chat_template_kwargs: { enable_thinking: false },
  };
}

type Chunk = {
  response?: unknown;
  choices?: { delta?: { content?: unknown }; finish_reason?: unknown }[];
};

/** One payload's piece of text, and whether it says the answer was cut off at the ceiling. */
function pieceOf(chunk: Chunk): { text: string; cut: boolean } {
  const choice = Array.isArray(chunk.choices) ? chunk.choices[0] : undefined;
  const content = choice?.delta?.content ?? chunk.response;
  return {
    text: typeof content === 'string' ? content : '',
    cut: choice?.finish_reason === 'length',
  };
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

/** The reply's text, from any shape the binding answers: `{ response }` (text, or the object JSON mode parsed),
 *  `{ choices: [{ message: { content } }] }`, or a string. Undefined when it holds none. */
export function builtInReplyText(raw: unknown): string | undefined {
  let value: unknown = raw;
  if (isObject(raw)) {
    if ('response' in raw) value = raw.response;
    else if (Array.isArray(raw.choices)) {
      const first: unknown = raw.choices[0];
      const message = isObject(first) ? first.message : undefined;
      value = isObject(message) ? message.content : undefined;
    } else value = undefined;
  }
  if (typeof value === 'string') return value;
  return isObject(value) ? JSON.stringify(value) : undefined;
}

const isStream = (value: unknown): value is ReadableStream<Uint8Array> =>
  typeof ReadableStream !== 'undefined' && value instanceof ReadableStream;

export type BuiltInReply = { text: string; stopReason: string; model: string };

const failed = () => new ModelCallError('built-in', 'other');

/** Sends `request` to built-in AI and reads the answer, calling `onText` with each piece as it arrives. Throws a
 *  ModelCallError (`built-in`, `other`) for every failure: the binding erring, a stream that breaks, no text at
 *  all, the caller's signal, or the timeout. */
export async function callBuiltIn(options: {
  ai: BuiltInAiBinding;
  request: ModelRequest;
  onText?: (text: string) => void;
  signal?: AbortSignal;
  timeoutMs?: number;
}): Promise<BuiltInReply> {
  const { ai, request, onText, signal } = options;
  if (signal?.aborted) throw failed();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped: (() => void) | undefined;
  // Ends the wait on the timeout or the caller's signal, whichever comes first.
  const stop = new Promise<never>((_resolve, reject) => {
    stopped = () => reject(failed());
    timer = setTimeout(stopped, options.timeoutMs ?? BUILT_IN_TIMEOUT_MS);
    signal?.addEventListener('abort', stopped, { once: true });
  });
  stop.catch(() => {});
  // Once the call has been given up, what still arrives is dropped and the stream is left.
  let over = false;
  const read = async (): Promise<BuiltInReply> => {
    let raw: unknown;
    try {
      raw = await ai.run(BUILT_IN_MODEL, builtInInput(request));
    } catch {
      // The binding's own words may echo the request: only that it failed.
      throw failed();
    }
    let text = '';
    let cut = false;
    if (isStream(raw)) {
      try {
        for await (const data of eventData(raw)) {
          if (over) break;
          const chunk = parseEvent<Chunk>(data);
          if (!chunk) continue;
          const piece = pieceOf(chunk);
          cut ||= piece.cut;
          if (!piece.text) continue;
          text += piece.text;
          onText?.(piece.text);
        }
      } catch {
        throw failed();
      }
    } else {
      text = builtInReplyText(raw) ?? '';
      if (text && !over) onText?.(text);
    }
    if (!text.trim()) throw failed();
    return { text, stopReason: cut ? 'max_tokens' : 'end_turn', model: BUILT_IN_MODEL };
  };
  try {
    return await Promise.race([read(), stop]);
  } finally {
    over = true;
    clearTimeout(timer);
    signal?.removeEventListener('abort', stopped!);
  }
}
