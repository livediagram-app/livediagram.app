// Send to Plan's memory (liveworkspace/docs/specs/004-index/send-to-plan.md "The picker"): the plan, board and column
// last sent to from each source item, in this browser, so the next send from the same item opens on them. One entry an
// item, the newest SEND_MEMORY_MAX kept. A per-viewer convenience: an unreadable or full storage forgets, never fails.

export const SEND_MEMORY_KEY = 'liveworkspace:send-to-plan:v1';
export const SEND_MEMORY_MAX = 50;

export type SendMemory = {
  planId: string;
  planTitle: string;
  board: string;
  column: string;
  at: number;
};

type Store = Pick<Storage, 'getItem' | 'setItem'>;

const storage = (): Store | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
};

const isMemory = (v: unknown): v is SendMemory => {
  if (!v || typeof v !== 'object') return false;
  const m = v as Record<string, unknown>;
  return (
    typeof m.planId === 'string' &&
    typeof m.planTitle === 'string' &&
    typeof m.board === 'string' &&
    typeof m.column === 'string' &&
    typeof m.at === 'number'
  );
};

function readAll(store: Store | null): Record<string, SendMemory> {
  try {
    const raw = store?.getItem(SEND_MEMORY_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: Record<string, SendMemory> = {};
    for (const [id, m] of Object.entries(parsed as Record<string, unknown>))
      if (isMemory(m)) out[id] = m;
    return out;
  } catch {
    return {};
  }
}

/** Where the last send from `sourceId` went, or null. */
export function recallSend(sourceId: string, store: Store | null = storage()): SendMemory | null {
  return readAll(store)[sourceId] ?? null;
}

/** Keeps where a send from `sourceId` went, the oldest entries past SEND_MEMORY_MAX forgotten. */
export function rememberSend(
  sourceId: string,
  memory: SendMemory,
  store: Store | null = storage(),
): void {
  const all = readAll(store);
  all[sourceId] = memory;
  const kept = Object.entries(all)
    .sort((a, b) => b[1].at - a[1].at)
    .slice(0, SEND_MEMORY_MAX);
  try {
    store?.setItem(SEND_MEMORY_KEY, JSON.stringify(Object.fromEntries(kept)));
  } catch {
    // Full or blocked: forgotten.
  }
}
