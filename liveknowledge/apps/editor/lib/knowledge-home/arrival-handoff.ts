// What Home hands the editor it is about to open (docs/specs/030-knowledgebase/knowledgebase-home.md): a question
// for Ask, Import to open, or the passage a search result named. Kept in `sessionStorage` for the one navigation: read once on arrival and removed, and
// ignored when older than two minutes or meant for another knowledgebase.

export const ARRIVAL_KEY = 'liveknowledge:home-arrival:v1';
export const ARRIVAL_TTL_MS = 120_000;

export type Arrival =
  | { kind: 'ask'; documentId: string; question: string }
  // `documentId` null: the knowledgebase /new is about to make.
  | { kind: 'import'; documentId: string | null }
  // A search result's passage: the page opens at `block`, its first block, as a result in the knowledgebase's own
  // search does (lib/knowledge/go-to-block.ts).
  | { kind: 'passage'; documentId: string; tab: string; block: string };

type Stored = Arrival & { at: number };

const store = (): Storage | null => {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
};

export function handArrival(arrival: Arrival, now = Date.now()): void {
  try {
    store()?.setItem(ARRIVAL_KEY, JSON.stringify({ ...arrival, at: now }));
  } catch {
    // A browser that keeps nothing: the knowledgebase opens without the extra step.
  }
}

function readStored(storage: Storage | null): Stored | null {
  try {
    return JSON.parse(storage?.getItem(ARRIVAL_KEY) ?? 'null') as Stored | null;
  } catch {
    return null;
  }
}

/** The arrival of `kind` meant for this knowledgebase, taken (so it happens once); null when there is none. */
export function takeArrival<K extends Arrival['kind']>(
  kind: K,
  documentId: string,
  now = Date.now(),
): Extract<Arrival, { kind: K }> | null {
  const storage = store();
  const stored = readStored(storage);
  if (!stored || typeof stored !== 'object' || stored.kind !== kind) return null;
  const mine = stored.documentId === null || stored.documentId === documentId;
  const fresh = typeof stored.at === 'number' && now - stored.at < ARRIVAL_TTL_MS;
  // One meant for elsewhere is left for it; a stale one is cleared.
  if (!mine && fresh) return null;
  try {
    storage?.removeItem(ARRIVAL_KEY);
  } catch {
    // Nothing to clear.
  }
  if (!mine || !fresh) return null;
  const { at: _at, ...arrival } = stored;
  return arrival as Extract<Arrival, { kind: K }>;
}
