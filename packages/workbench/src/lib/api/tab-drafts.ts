// Drafts of unsaved changes (livediagram's docs/specs/006-document/delta-saves.md "Drafts of unsaved changes"): the
// unload flush keeps a copy of each tab it sends in this browser, stamped with the revision of the base copy it was
// based on, and the next load of that tab decides what to do with it. A draft never overwrites newer work: it is put
// back on screen only while the api still holds its revision. The product binds the storage (`TabDraftStore`); every
// call into it is guarded, so an editor without browser storage keeps no drafts and works as before.
import { debugLog } from '../debug-log';

/** The longest tab JSON a draft holds, about six times a 2,000-element tab. Safe range: 1,000,000 to 8,000,000. */
export const TAB_DRAFT_MAX_CHARS = 4_000_000;

const TAB_DRAFT_VERSION = 1;

/** One draft as stored. */
export type TabDraftRecord = {
  v: typeof TAB_DRAFT_VERSION;
  // The revision of the base copy the draft was made over.
  baseRev: number;
  // The tab as the flush sent it, as JSON.
  tab: string;
  // The elements the flush's delta added or updated, and removed, over the base copy; null when it planned none.
  changed: string[] | null;
  removed: string[] | null;
};

/** Where drafts live, bound by the product. Any call may throw or reject; the drafts swallow it. `write` and `remove`
 *  start at once and are never awaited: the page may be going. */
export type TabDraftStore = {
  read: (key: string) => Promise<unknown>;
  write: (key: string, record: TabDraftRecord) => void;
  remove: (key: string) => void;
};

type DraftTab = { id: string; elements: unknown[]; name?: unknown };

/** What the next load found: no draft, one that landed after all, one to put back on screen, or one somebody's newer
 *  save overtook (removed; the editor says so). */
export type TabDraftVerdict<T> =
  | { kind: 'none' }
  | { kind: 'saved' }
  | { kind: 'replay'; tab: T }
  | { kind: 'stale'; name: string | null };

/** Told when a load puts a draft back (`replay`, taken with `takeReplay`) or drops one (`stale`). */
export type TabDraftEvent = {
  kind: 'replay' | 'stale';
  ownerId: string;
  itemId: string;
  tabId: string;
  name: string | null;
};

const isIdList = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((id) => typeof id === 'string');

// The stored draft with its tab parsed, or null when it is not one this build wrote for this tab.
function parseDraft(
  raw: unknown,
  tabId: string,
): (Omit<TabDraftRecord, 'tab'> & { tab: DraftTab }) | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Partial<Record<keyof TabDraftRecord, unknown>>;
  if (r.v !== TAB_DRAFT_VERSION || typeof r.tab !== 'string') return null;
  if (!Number.isSafeInteger(r.baseRev) || (r.baseRev as number) < 0) return null;
  const changed = r.changed === null ? null : isIdList(r.changed) ? r.changed : undefined;
  const removed = r.removed === null ? null : isIdList(r.removed) ? r.removed : undefined;
  if (changed === undefined || removed === undefined) return null;
  let tab: unknown;
  try {
    tab = JSON.parse(r.tab);
  } catch {
    return null;
  }
  const t = tab as Partial<DraftTab> | null;
  if (typeof t !== 'object' || t === null || t.id !== tabId || !Array.isArray(t.elements)) {
    return null;
  }
  return {
    v: TAB_DRAFT_VERSION,
    baseRev: r.baseRev as number,
    tab: t as DraftTab,
    changed,
    removed,
  };
}

// Whether every element the draft changed is stored as the draft has it and every one it removed is gone: the
// flush landed, and a later save of somebody else's did not touch them.
function landedIn(
  draft: { tab: DraftTab; changed: string[]; removed: string[] },
  stored: readonly unknown[],
): boolean {
  const byId = (els: readonly unknown[]) =>
    new Map(els.map((el) => [(el as { id?: unknown }).id, el] as const));
  const storedById = byId(stored);
  const draftById = byId(draft.tab.elements);
  if (draft.removed.some((id) => storedById.has(id))) return false;
  return draft.changed.every((id) => {
    const mine = draftById.get(id);
    const theirs = storedById.get(id);
    return mine !== undefined && JSON.stringify(mine) === JSON.stringify(theirs);
  });
}

/** The verdict on `draft` over the tab as stored: put back while the api holds its revision; otherwise landed when
 *  the stored elements are the draft's (or hold every change it made); otherwise overtaken. */
export function judgeTabDraft<T>(
  draft: Omit<TabDraftRecord, 'tab'> & { tab: DraftTab },
  stored: { rev: number; elements: readonly unknown[] },
): TabDraftVerdict<T> {
  if (stored.rev === draft.baseRev) return { kind: 'replay', tab: draft.tab as T };
  if (JSON.stringify(draft.tab.elements) === JSON.stringify(stored.elements)) {
    return { kind: 'saved' };
  }
  const { changed, removed } = draft;
  if (changed && removed && landedIn({ tab: draft.tab, changed, removed }, stored.elements)) {
    return { kind: 'saved' };
  }
  return { kind: 'stale', name: typeof draft.tab.name === 'string' ? draft.tab.name : null };
}

export function createTabDrafts<T extends { id: string }>(store: TabDraftStore) {
  const keyOf = (ownerId: string, itemId: string, tabId: string) => `${ownerId}␟${itemId}␟${tabId}`;
  // The drafts this page knows of, by key, at the order they were written or put back; a save clears one only when
  // it started after it, since only then does it carry the draft's content.
  const known = new Map<string, number>();
  let order = 0;
  // Drafts a load put back, waiting for the editor to take them on screen.
  const replays = new Map<string, T>();
  const listeners = new Set<(event: TabDraftEvent) => void>();

  const guarded = (step: () => void) => {
    try {
      step();
    } catch {
      // No browser storage: no drafts, and the editor works as before.
    }
  };
  const remove = (key: string) => {
    known.delete(key);
    guarded(() => store.remove(key));
  };
  const emit = (event: TabDraftEvent) => {
    for (const listener of listeners) guarded(() => listener(event));
  };

  /** Keep `draft` for the tab, replacing any older one; past TAB_DRAFT_MAX_CHARS it is not kept and an older one goes. */
  function write(
    ownerId: string,
    itemId: string,
    tabId: string,
    draft: Omit<TabDraftRecord, 'v'>,
  ): void {
    const key = keyOf(ownerId, itemId, tabId);
    if (draft.tab.length > TAB_DRAFT_MAX_CHARS) {
      debugLog('[tab-draft] too large to keep', { tabId, chars: draft.tab.length });
      remove(key);
      return;
    }
    known.set(key, ++order);
    guarded(() => store.write(key, { v: TAB_DRAFT_VERSION, ...draft }));
  }

  /** The order a save starts at, for `saveLanded`. */
  function saveStarted(): number {
    return ++order;
  }

  /** A save of the tab that started at `startedAt` landed: a draft kept before it is in what it stored, so it goes. */
  function saveLanded(ownerId: string, itemId: string, tabId: string, startedAt: number): void {
    const key = keyOf(ownerId, itemId, tabId);
    const at = known.get(key);
    if (at === undefined || at > startedAt) return;
    remove(key);
  }

  /** The stored draft for the tab, read beside the tab's own load; undefined when none (or storage fails). */
  async function read(ownerId: string, itemId: string, tabId: string): Promise<unknown> {
    try {
      return await store.read(keyOf(ownerId, itemId, tabId));
    } catch {
      return undefined;
    }
  }

  /** Decide on the draft `read` answered, now the tab as stored is known. A draft put back waits in `takeReplay`;
   *  every other draft is removed. */
  function settle(
    ownerId: string,
    itemId: string,
    tabId: string,
    raw: unknown,
    stored: { rev: number; elements: readonly unknown[] },
    normalize: (tab: T) => T = (tab) => tab,
  ): TabDraftVerdict<T> {
    if (raw === undefined || raw === null) return { kind: 'none' };
    const key = keyOf(ownerId, itemId, tabId);
    const draft = parseDraft(raw, tabId);
    if (!draft) {
      remove(key);
      return { kind: 'none' };
    }
    const verdict = judgeTabDraft<T>(draft, stored);
    debugLog('[tab-draft] found', { tabId, verdict: verdict.kind, baseRev: draft.baseRev });
    if (verdict.kind !== 'replay') {
      remove(key);
      if (verdict.kind === 'stale') {
        emit({ kind: 'stale', ownerId, itemId, tabId, name: verdict.name });
      }
      return verdict;
    }
    const tab = normalize(verdict.tab);
    known.set(key, ++order);
    replays.set(key, tab);
    emit({ kind: 'replay', ownerId, itemId, tabId, name: null });
    return { kind: 'replay', tab };
  }

  /** The draft a load put back for the tab, once: the editor puts it on screen as an unsaved edit. */
  function takeReplay(ownerId: string, itemId: string, tabId: string): T | null {
    const key = keyOf(ownerId, itemId, tabId);
    const tab = replays.get(key) ?? null;
    replays.delete(key);
    return tab;
  }

  /** Hear each draft a load puts back or drops. Answers the unsubscribe. */
  function subscribe(listener: (event: TabDraftEvent) => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return { write, saveStarted, saveLanded, read, settle, takeReplay, subscribe };
}

export type TabDrafts<T extends { id: string }> = ReturnType<typeof createTabDrafts<T>>;
