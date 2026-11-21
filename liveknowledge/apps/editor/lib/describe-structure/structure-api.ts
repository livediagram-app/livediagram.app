// POST .../pages/<tab>/describe-structure from the editor (docs/specs/030-knowledgebase/describe-to-set-up.md
// "Describe Structure on a page"): one request that answers a page's drafted structure, or why there is none. A
// failure is a kind the dialog words itself (structure-words.ts): the route's own message is never shown.
import type {
  KnowledgeAiProvider,
  KnowledgeSetupProvider,
  PageStructureBlock,
  PageStructureRequest,
} from '@liveknowledge/api-schema';
import { apiFetch } from '@/lib/api/core';
import { knowledgeHeaders, knowledgeUrl, type KnowledgeCaller } from '@/lib/api/knowledge';

/** How long a draft may take: one model call of at most 2,000 tokens, asked twice at most on built-in AI. */
export const STRUCTURE_TIMEOUT_MS = 90_000;

export type StructureOutcome =
  | { ok: true; blocks: PageStructureBlock[]; provider: KnowledgeSetupProvider }
  /** `kind`: the model call's failure, the route's refusal, or this client's own (`network`, `aborted`). */
  | { ok: false; kind: string; provider?: KnowledgeAiProvider };

export async function apiDescribeStructure(
  who: KnowledgeCaller,
  documentId: string,
  tab: string,
  body: PageStructureRequest,
  signal: AbortSignal,
): Promise<StructureOutcome> {
  let res: Response;
  try {
    res = await apiFetch(
      knowledgeUrl(documentId, `pages/${encodeURIComponent(tab)}/describe-structure`),
      {
        method: 'POST',
        headers: await knowledgeHeaders(who, true),
        body: JSON.stringify(body),
        signal: AbortSignal.any([signal, AbortSignal.timeout(STRUCTURE_TIMEOUT_MS)]),
      },
    );
  } catch {
    return { ok: false, kind: signal.aborted ? 'aborted' : 'network' };
  }
  const read = (await res.json().catch(() => null)) as {
    blocks?: unknown;
    provider?: unknown;
    error?: unknown;
  } | null;
  if (res.ok) {
    const blocks = Array.isArray(read?.blocks) ? (read.blocks as PageStructureBlock[]) : [];
    const provider = read?.provider;
    return blocks.length > 0 &&
      (provider === 'built-in' || provider === 'anthropic' || provider === 'openai')
      ? { ok: true, blocks, provider }
      : { ok: false, kind: 'no-structure' };
  }
  const kind =
    typeof read?.error === 'string' ? read.error : res.status === 403 ? 'forbidden' : 'other';
  const provider =
    read?.provider === 'anthropic' || read?.provider === 'openai' ? read.provider : undefined;
  return { ok: false, kind, ...(provider ? { provider } : {}) };
}
