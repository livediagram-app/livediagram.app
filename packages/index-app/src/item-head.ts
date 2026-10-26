// An item's owner and team, as its Durable Object keeps them (liveworkspace/docs/specs/004-index/one-explorer-contracts.md
// "Grants"). The index decides both, and changes them without asking the item: a guest who becomes an account takes
// over everything the guest owned, and an item moves to another team or back to its owner. The item keeps a copy for
// the work it does with no request in hand (its emails, its Inbox and Timeline pushes, its alarm), and that copy is
// only as fresh as the last time the index said.
//
// Every grant says: `owner` and `team` are the item's as the index has them when it signs. So the item takes its copy
// from each grant it is handed (a socket's ticket, a renewal, an API request's grant), with `createItemHeadSync`:
// the first grant after the Durable Object wakes reads the stored copy once; after that, a grant that says the same
// costs nothing, and one that says something new writes it. A merge or a move reaches the item the next time anyone
// opens it, within the ten minutes a grant lasts for a session already open.
//
// A grant signed before the index named the owner carries no `owner`: it changes nothing.

export type ItemHead = { ownerId: string; teamId: string | null };

// The head a grant (or an app's ItemGrant) names, or null when it names no owner.
export function itemHeadOf(grant: { owner?: string | null; team: string | null }): ItemHead | null {
  return grant.owner ? { ownerId: grant.owner, teamId: grant.team } : null;
}

export const sameItemHead = (a: ItemHead, b: ItemHead): boolean =>
  a.ownerId === b.ownerId && a.teamId === b.teamId;

export type ItemHeadStore = {
  // The stored copy, or null for an item not started (nothing to correct).
  read: () => Promise<ItemHead | null>;
  // Store the fresh copy.
  write: (head: ItemHead) => Promise<unknown>;
};

export type ItemHeadSync = {
  // Bring the stored copy in line with what a grant names. Answers the head written, or null when nothing changed.
  sync: (grant: { owner?: string | null; team: string | null }) => Promise<ItemHead | null>;
  // Forget what was last seen, after the app changes the stored copy itself (an owner anonymised).
  forget: () => void;
};

/** One per Durable Object instance: keeps the item's stored owner and team in line with the grants it is handed. */
export function createItemHeadSync(store: ItemHeadStore): ItemHeadSync {
  // The copy as last read or written, so a grant that agrees with it touches no storage.
  let known: ItemHead | null = null;
  let pending: Promise<ItemHead | null> | null = null;

  const apply = async (fresh: ItemHead): Promise<ItemHead | null> => {
    if (known && sameItemHead(known, fresh)) return null;
    const stored = await store.read();
    if (!stored) return null;
    if (sameItemHead(stored, fresh)) {
      known = stored;
      return null;
    }
    await store.write(fresh);
    known = fresh;
    return fresh;
  };

  return {
    async sync(grant) {
      const fresh = itemHeadOf(grant);
      if (!fresh || (known && sameItemHead(known, fresh))) return null;
      // One at a time: two sockets joining together read and write once.
      const run = (pending ?? Promise.resolve(null)).catch(() => null).then(() => apply(fresh));
      pending = run;
      try {
        return await run;
      } finally {
        if (pending === run) pending = null;
      }
    },
    forget() {
      known = null;
    },
  };
}
