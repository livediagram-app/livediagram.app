// The reactions on each page (docs/specs/030-knowledgebase/page-reactions.md): read once when a page first opens in a
// session, kept current by the room's `page-reaction` ops, and changed here with the press shown at once and taken
// back if the api refuses it. Outside React: the capsule subscribes and reads one page's list, which keeps its
// identity until that page's reactions change, so a reaction never renders anything but the capsule.
import type { PageReaction, PageReactionOp } from '@liveknowledge/api-schema';
import { apiChangePageReaction, apiPageReactions } from '@/lib/api/page-feedback';
import type { KnowledgeCaller } from '@/lib/api/knowledge';
import { withPageReaction } from './reaction-groups';

export type PageReactionsApi = {
  list: typeof apiPageReactions;
  change: typeof apiChangePageReaction;
};

export type PageReactionsEntry = {
  status: 'loading' | 'ready' | 'failed';
  reactions: readonly PageReaction[];
};

const EMPTY: readonly PageReaction[] = [];
const LOADING: PageReactionsEntry = { status: 'loading', reactions: EMPTY };

export function createPageReactionsStore(
  api: PageReactionsApi = { list: apiPageReactions, change: apiChangePageReaction },
) {
  const entries = new Map<string, PageReactionsEntry>();
  const loading = new Map<string, Promise<void>>();
  const listeners = new Set<() => void>();
  let version = 0;
  const keyOf = (documentId: string, tab: string) => `${documentId}\u0000${tab}`;
  const put = (key: string, entry: PageReactionsEntry) => {
    entries.set(key, entry);
    version++;
    for (const listener of listeners) listener();
  };
  const reactionsAt = (key: string) => entries.get(key)?.reactions ?? EMPTY;
  // One reaction's change to what is held, only when the page has been read and the change moves something.
  const apply = (key: string, reaction: PageReaction, on: boolean) => {
    const entry = entries.get(key);
    if (!entry || entry.status !== 'ready') return;
    const next = withPageReaction(entry.reactions, reaction, on);
    if (next !== entry.reactions) put(key, { status: 'ready', reactions: next });
  };

  return {
    subscribe: (listener: () => void): (() => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    version: () => version,
    /** The page's reactions; `_at`, the store's version the caller read, for a memoising compiler. */
    entryOf: (documentId: string, tab: string, _at?: number): PageReactionsEntry =>
      entries.get(keyOf(documentId, tab)) ?? LOADING,
    /** Read the page's reactions: once a session unless `fresh`; concurrent asks share one request. */
    load(who: KnowledgeCaller, documentId: string, tab: string, fresh = false): Promise<void> {
      const key = keyOf(documentId, tab);
      if (!fresh && entries.get(key)?.status === 'ready') return Promise.resolve();
      const running = loading.get(key);
      if (running) return running;
      const request = api
        .list(who, documentId, tab)
        .then(
          (reactions) => put(key, { status: 'ready', reactions }),
          () => {
            if (entries.get(key)?.status !== 'ready')
              put(key, { status: 'failed', reactions: reactionsAt(key) });
          },
        )
        .finally(() => loading.delete(key));
      loading.set(key, request);
      return request;
    },
    /** The room's op. A page not read here is left to its first read. */
    receive(documentId: string, op: PageReactionOp): void {
      apply(keyOf(documentId, op.tabId), op.reaction, op.on);
    },
    /** Add or take back `reaction` (yours), shown at once; a refusal takes it back again and rejects. */
    async toggle(
      who: KnowledgeCaller,
      documentId: string,
      tab: string,
      reaction: PageReaction,
      on: boolean,
    ): Promise<void> {
      const key = keyOf(documentId, tab);
      apply(key, reaction, on);
      try {
        await api.change(who, documentId, tab, { emoji: reaction.emoji, on, name: reaction.name });
      } catch (err) {
        apply(key, reaction, !on);
        throw err;
      }
    },
  };
}

export type PageReactionsStore = ReturnType<typeof createPageReactionsStore>;

/** The editor's one store. */
export const pageReactionsStore = createPageReactionsStore();
