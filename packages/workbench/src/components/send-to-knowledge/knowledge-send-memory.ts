// Send to Knowledge Base's memory (liveworkspace/docs/specs/004-index/send-to-knowledge.md "The picker" step 2): the
// knowledgebase last sent to from each source item, in this browser, so the next send from it opens on it. One entry
// an item, the newest KNOWLEDGE_MEMORY_MAX kept. A per-viewer convenience: unreadable or full storage forgets, never
// fails.

export const KNOWLEDGE_MEMORY_KEY = 'liveworkspace:send-to-knowledge:v1';
export const KNOWLEDGE_MEMORY_MAX = 50;

export type KnowledgeMemory = { kbId: string; kbTitle: string; at: number };

type Store = Pick<Storage, 'getItem' | 'setItem'>;

const storage = (): Store | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
};

const isMemory = (v: unknown): v is KnowledgeMemory => {
  if (!v || typeof v !== 'object') return false;
  const m = v as Record<string, unknown>;
  return typeof m.kbId === 'string' && typeof m.kbTitle === 'string' && typeof m.at === 'number';
};

function readAll(store: Store | null): Record<string, KnowledgeMemory> {
  try {
    const raw = store?.getItem(KNOWLEDGE_MEMORY_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: Record<string, KnowledgeMemory> = {};
    for (const [id, m] of Object.entries(parsed as Record<string, unknown>))
      if (isMemory(m)) out[id] = m;
    return out;
  } catch {
    return {};
  }
}

/** The knowledgebase the last send from `sourceId` went to, or null. */
export function recallKnowledgeSend(
  sourceId: string,
  store: Store | null = storage(),
): KnowledgeMemory | null {
  return readAll(store)[sourceId] ?? null;
}

/** Keeps where a send from `sourceId` went, the oldest entries past KNOWLEDGE_MEMORY_MAX forgotten. */
export function rememberKnowledgeSend(
  sourceId: string,
  memory: KnowledgeMemory,
  store: Store | null = storage(),
): void {
  const all = { ...readAll(store), [sourceId]: memory };
  const kept = Object.entries(all)
    .sort((a, b) => b[1].at - a[1].at)
    .slice(0, KNOWLEDGE_MEMORY_MAX);
  try {
    store?.setItem(KNOWLEDGE_MEMORY_KEY, JSON.stringify(Object.fromEntries(kept)));
  } catch {
    // Full or blocked: the next send starts unpicked.
  }
}
