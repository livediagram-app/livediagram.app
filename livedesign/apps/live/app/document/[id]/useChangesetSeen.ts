import { useCallback, useRef, useState } from 'react';
import { noteLoadedRev, type ChangesetSeen } from './changeset-seen';

// The changeset revision each loaded tab holds (docs/specs/024-agents/agent-changesets.md "The
// editor"), twice over:
//   - `seenRef`, raised the moment content lands, which decides whether the next relayed changeset
//     is news (admitChangesetOp);
//   - `seen`, state set in the SAME batch as the tab content it describes, which is what a save
//     sends as X-Changeset-Seen. A save built from a render that predates a changeset must never
//     claim it: the api would then skip merging a change the save does not hold, and lose it.
//     Claiming less than it holds is harmless: the merge is idempotent.
export function useChangesetSeen() {
  const seenRef = useRef<ChangesetSeen>(new Map());
  const [seen, setSeen] = useState<ReadonlyMap<string, number>>(() => new Map());
  // Call it beside the update that puts the content in place, in the same synchronous block, so
  // React commits both together.
  const noteSeen = useCallback((tabId: string, rev: number) => {
    noteLoadedRev(seenRef.current, tabId, rev);
    setSeen((prev) => {
      if ((prev.get(tabId) ?? -1) >= rev) return prev;
      const next = new Map(prev);
      next.set(tabId, rev);
      return next;
    });
  }, []);
  return { seenRef, seen, noteSeen };
}
