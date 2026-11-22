// The api's refusals as agents read them ("Errors that teach"): the shared wording
// (@liveworkspace/agent-verbs/api-refusal), naming this product's knowledgebases and tools.
//
// The knowledge routes refuse in words of their own (`page_verified`, `scope_needed`, `passage_not_found`,
// `suggestion_stale`: docs/specs/024-agents/knowledgebase-for-agents.md), each saying what to send instead, so a
// refusal that carries a message is answered with it. Any other takes the shared words, where the api's `document`
// is said as a person says it: a knowledgebase.
import { ApiError } from '@liveworkspace/api-client';
import { createApiRefusal, createDeleteRefusal } from '@liveworkspace/agent-verbs/api-refusal';
import { AGENT_PRODUCT } from './agent-product';

const shared = createApiRefusal(AGENT_PRODUCT);

// The api's own words for a refusal: its body's `error` code beside a `message`.
function saidBy(err: ApiError): { code: string; message: string } | null {
  try {
    const body = JSON.parse(err.body) as { message?: unknown };
    return err.code && typeof body.message === 'string' && body.message
      ? { code: err.code, message: body.message }
      : null;
  } catch {
    return null;
  }
}

export function apiRefusalOf(err: unknown): { code: string; message: string } | null {
  if (err instanceof ApiError && err.status < 500) {
    const said = saidBy(err);
    if (said) return said;
  }
  const known = shared(err);
  // `restore_document` and `find_documents` are tool names and stay; the word alone is the product's.
  return known && { ...known, message: known.message.replace(/\bdocument\b/g, AGENT_PRODUCT.word) };
}

export const deleteRefusal = createDeleteRefusal(AGENT_PRODUCT);
