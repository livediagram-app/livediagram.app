// POST .../setup/suggest from the editor (docs/specs/030-knowledgebase/describe-to-set-up.md "The model"): one
// request that answers a proposed structure, or why there is none. A failure is a kind the dialog words itself
// (setup-words.ts): the route's own message is never shown, and nothing here is handed the team's key.
import type {
  KnowledgeAiProvider,
  KnowledgeSetupRequest,
  KnowledgeSetupSuggestion,
} from '@liveknowledge/api-schema';
import { apiFetch } from '@/lib/api/core';
import { knowledgeHeaders, knowledgeUrl, type KnowledgeCaller } from '@/lib/api/knowledge';

/** How long a suggestion may take: one model call of at most 4,000 tokens. */
export const SETUP_TIMEOUT_MS = 90_000;

export type SetupOutcome =
  | { ok: true; suggestion: KnowledgeSetupSuggestion }
  /** `kind`: the model call's failure, the route's refusal (`person-limit`, `ask_unavailable`, `no-structure`),
   *  or this client's own (`network`, `aborted`). */
  | { ok: false; kind: string; provider?: KnowledgeAiProvider };

const isSuggestion = (value: unknown): value is KnowledgeSetupSuggestion =>
  !!value &&
  typeof (value as KnowledgeSetupSuggestion).name === 'string' &&
  Array.isArray((value as KnowledgeSetupSuggestion).pages) &&
  (value as KnowledgeSetupSuggestion).pages.length > 0;

export async function apiSuggestSetup(
  who: KnowledgeCaller,
  documentId: string,
  body: KnowledgeSetupRequest,
  signal: AbortSignal,
): Promise<SetupOutcome> {
  let res: Response;
  try {
    res = await apiFetch(knowledgeUrl(documentId, 'setup/suggest'), {
      method: 'POST',
      headers: await knowledgeHeaders(who, true),
      body: JSON.stringify(body),
      signal: AbortSignal.any([signal, AbortSignal.timeout(SETUP_TIMEOUT_MS)]),
    });
  } catch {
    return { ok: false, kind: signal.aborted ? 'aborted' : 'network' };
  }
  const read = (await res.json().catch(() => null)) as
    (Partial<KnowledgeSetupSuggestion> & { error?: unknown; provider?: unknown }) | null;
  if (res.ok) {
    return isSuggestion(read)
      ? { ok: true, suggestion: read }
      : { ok: false, kind: 'no-structure' };
  }
  const kind =
    typeof read?.error === 'string' ? read.error : res.status === 403 ? 'forbidden' : 'other';
  const provider =
    read?.provider === 'anthropic' || read?.provider === 'openai' ? read.provider : undefined;
  return { ok: false, kind, ...(provider ? { provider } : {}) };
}
