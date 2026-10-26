// A tab-scoped session's ops in the room (docs/specs/013-workspace/tab-scoped-share-links.md "Structure"): each keeps
// its tab's structure or is dropped (room-structure-gate.ts). An op the gate can answer alone relays at once; one that
// needs the stored tab waits for it, and every later op from a scoped session queues behind it, so a scoped
// session's ops still reach everyone in the order it sent them.
import { structureAgainst, structureFirst } from './room-structure-gate';
import type { StructuredTab } from './tab-structure';
import { getTab, getTabRev } from './db';
import type { PlanEnv } from './types';

type StoredTabReader = (projectId: string, tabId: string) => Promise<StructuredTab | null>;

export class RoomScopedStructure {
  private chain: Promise<void> = Promise.resolve();
  private waiting = 0;

  private readonly readStored: StoredTabReader;

  constructor(readStored: StoredTabReader) {
    this.readStored = readStored;
  }

  /** Runs `relay` for an op that keeps its tab's structure, now or once its check lands; drops any other. */
  admit(op: unknown, scope: string, projectId: string | null, relay: () => void): void {
    const verdict = structureFirst(op, scope);
    if (verdict === 'drop') return dropped(op);
    if (verdict === 'relay' && this.waiting === 0) return relay();
    this.waiting += 1;
    this.chain = this.chain
      .then(async () => {
        if (verdict === 'relay') return relay();
        const stored = projectId === null ? null : await this.readStored(projectId, scope);
        if (structureAgainst(op, stored, scope)) relay();
        else dropped(op);
      })
      .catch((err: unknown) => {
        // A failed read relays nothing: the op is refused rather than let through unchecked.
        console.warn('[room] scoped.structure.failed', { error: String(err) });
      })
      .finally(() => {
        this.waiting -= 1;
      });
  }

  /** Resolves once every queued op has been relayed or dropped (tests). */
  settled(): Promise<void> {
    return this.chain;
  }
}

// How many scoped tabs' stored structure one room keeps parsed: a room's scoped sessions are usually on one tab.
export const SCOPED_TABS_CACHED = 4;

/**
 * The stored tab as the check reads it, parsed again only when its revision has moved on: a scoped Editor's drags
 * cost one revision read each, not a parse of the whole tab.
 */
export function cachedStoredTab(env: PlanEnv | undefined): StoredTabReader {
  const cache = new Map<string, { rev: number; tab: StructuredTab }>();
  return async (projectId, tabId) => {
    if (!env) return null;
    const rev = await getTabRev(env, projectId, tabId);
    if (rev === null) return null;
    const key = `${projectId}\u0000${tabId}`;
    const hit = cache.get(key);
    if (hit && hit.rev === rev) return hit.tab;
    const tab = await getTab(env, projectId, tabId);
    if (!tab) return null;
    const slim: StructuredTab = { name: tab.name, elements: tab.elements, form: tab.form };
    cache.delete(key);
    cache.set(key, { rev: tab.rev ?? rev, tab: slim });
    while (cache.size > SCOPED_TABS_CACHED) cache.delete(cache.keys().next().value!);
    return slim;
  };
}

function dropped(op: unknown): void {
  console.info('[room] scoped.structure.dropped', {
    kind: (op as { kind?: unknown } | null)?.kind,
  });
}
