// The pages that link to a page (docs/specs/030-knowledgebase/links-and-embeds.md "Backlinks"), as the editor holds
// them: read from `GET pages/<tab>/backlinks` whenever the page opens, the last answer shown meanwhile so the
// section never blinks, and read again after this editor saved a change to a page's links. Outside React.
import { pageLinkTargets } from '@liveknowledge/knowledge';
import type { KnowledgeBacklink } from '@liveknowledge/api-schema';
import type { ArticleBlock } from '@liveknowledge/document';
import { apiPageBacklinks, type KnowledgeCaller } from '@/lib/api/knowledge';

/** How long after a commit that changed a page's links its save is taken to have landed (ms): the autosave's own
 *  pause, and the request. The editor's store says nothing when a save completes. */
export const LINKS_SETTLE_MS = 3000;

const NONE: readonly KnowledgeBacklink[] = [];

export function createBacklinksStore(read: typeof apiPageBacklinks = apiPageBacklinks) {
  const held = new Map<string, readonly KnowledgeBacklink[]>();
  const running = new Map<string, Promise<void>>();
  const listeners = new Set<() => void>();
  const keyOf = (documentId: string, tab: string) => `${documentId}\u0000${tab}`;
  return {
    subscribe: (listener: () => void): (() => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    /** The last answer for a page; none before the first, and for a page nothing links to. */
    of: (documentId: string, tab: string): readonly KnowledgeBacklink[] =>
      held.get(keyOf(documentId, tab)) ?? NONE,
    /** Read a page's backlinks. One request a page at a time; a failure keeps the last answer. */
    load(who: KnowledgeCaller, documentId: string, tab: string): Promise<void> {
      const key = keyOf(documentId, tab);
      const now = running.get(key);
      if (now) return now;
      const request = read(who, documentId, tab)
        .then(
          (backlinks) => {
            const was = held.get(key) ?? NONE;
            const same =
              was.length === backlinks.length &&
              was.every((b, i) => b.tab === backlinks[i]!.tab && b.title === backlinks[i]!.title);
            if (same) return;
            held.set(key, backlinks);
            for (const listener of listeners) listener();
          },
          () => {},
        )
        .finally(() => running.delete(key));
      running.set(key, request);
      return request;
    },
  };
}

export const backlinksStore = createBacklinksStore();

const targets = new WeakMap<readonly ArticleBlock[], string>();

/** The pages a writing links to, as one string to compare: kept per block list, so only a commit reads it, and a
 *  commit that changed no link answers the same string. */
export function linkTargetsKey(blocks: readonly ArticleBlock[] | undefined): string {
  if (!blocks) return '';
  let key = targets.get(blocks);
  if (key === undefined) {
    key = pageLinkTargets({ blocks: blocks as ArticleBlock[] })
      .toSorted()
      .join('\u0000');
    targets.set(blocks, key);
  }
  return key;
}
