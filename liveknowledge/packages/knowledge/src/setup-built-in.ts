// Describe to Set Up on built-in AI (docs/specs/030-knowledgebase/describe-to-set-up.md "The model"; owner,
// 2026-11-21): with no team key, the suggestion is asked of Cloudflare Workers AI through the api's `AI` binding, the
// model liveplanner's Describe a Plan uses. This module writes the request in Workers AI's chat shape and reads the
// binding's answer into the text `parseSetupSuggestion` reads; the api makes the call and keeps the count
// (apps/api/src/knowledge/setup-built-in-ai.ts). Pure.
import { BUILT_IN_MODEL, fenced } from '@liveworkspace/ai';
import { SETUP_MAX_PAGES } from './setup-limits';
import { setupRequest, type SetupExistingPage } from './setup-request';

/** liveplanner's Describe a Plan model (its automation-ai.ts): small, cheap, with JSON mode, thinking off. The one
 *  model built-in AI answers everything with (built-in-client.ts). */
export const SETUP_BUILT_IN_MODEL = BUILT_IN_MODEL;
/** The asks one suggestion may make: the first, and one more with what was wrong with the first reply. */
export const SETUP_BUILT_IN_ASKS = 2;
/** How long one built-in ask may take before it is given up. */
export const SETUP_BUILT_IN_TIMEOUT_MS = 60_000;
/** Built-in suggestions one person may ask for in a UTC day, across every knowledgebase (liveplanner's
 *  PLAN_DRAFT_PER_DAY): liveknowledge pays for these. */
export const SETUP_BUILT_IN_PER_PERSON_PER_DAY = 10;

/** The words the second ask is given for a first reply that did not read: fixed, never the model's own text. */
export const SETUP_REFUSED_NOT_JSON = 'the reply was not one JSON object in the shape asked for';
export const SETUP_REFUSED_NO_PAGE = 'the reply held no page that could be used';

/** The reply's shape, for Workers AI's JSON mode. The reader checks every field again whatever the model sends. */
export const SETUP_REPLY_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    pages: {
      type: 'array',
      maxItems: SETUP_MAX_PAGES,
      items: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          title: { type: 'string' },
          summary: { type: 'string' },
          headings: { type: 'array', items: { type: 'string' } },
          parent: { type: ['integer', 'null'] },
        },
        required: ['id', 'title', 'summary', 'headings', 'parent'],
        additionalProperties: false,
      },
    },
  },
  required: ['name', 'pages'],
  additionalProperties: false,
} as const;

/** What the `AI` binding's `run` is handed for a suggestion. */
export type SetupBuiltInInput = {
  messages: { role: 'system' | 'user'; content: string }[];
  max_tokens: number;
  temperature: 0;
  response_format: {
    type: 'json_schema';
    json_schema: { name: string; schema: typeof SETUP_REPLY_SCHEMA; strict: true };
  };
  chat_template_kwargs: { enable_thinking: false };
};

/** The ask: `setupRequest`'s system prompt and fenced material in Workers AI's chat shape. `refused`: on the second
 *  ask, why the first reply was not used (fixed words), fenced like the rest. */
export function setupBuiltInInput(
  options: { description: string; existing?: readonly SetupExistingPage[] },
  refused?: string,
): SetupBuiltInInput {
  const request = setupRequest(options);
  const message = request.messages[0]!.content;
  const content = refused
    ? `${message}\n<previous_reply>\nYour previous reply could not be used: ${fenced(refused)}. Reply again with the one JSON object only.\n</previous_reply>`
    : message;
  return {
    messages: [
      { role: 'system', content: request.system },
      { role: 'user', content },
    ],
    max_tokens: request.maxTokens,
    temperature: 0,
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'knowledgebase_structure', schema: SETUP_REPLY_SCHEMA, strict: true },
    },
    chat_template_kwargs: { enable_thinking: false },
  };
}
