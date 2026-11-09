// The last revision the editor knows for each tab (docs/specs/013-workspace/blueprints/
// workbench-embeds.md "The selection reference"): what its loads and the changesets relayed to it
// noted (the changeset-seen map), or what its own saves were answered with, whichever is later. Kept
// apart from changeset-seen, which says which changesets this editor has applied: a save's revision
// may include changesets the api merged that the editor has not received yet.
import { useCallback, useRef } from 'react';

export function useTabRevisions(seen: ReadonlyMap<string, number>) {
  const savedRef = useRef(new Map<string, number>());
  const noteSaved = useCallback((tabId: string, rev: number) => {
    const saved = savedRef.current;
    if ((saved.get(tabId) ?? -1) < rev) saved.set(tabId, rev);
  }, []);
  // Read when a message is built, never during render.
  const revOf = useCallback(
    (tabId: string) => Math.max(seen.get(tabId) ?? 0, savedRef.current.get(tabId) ?? 0),
    [seen],
  );
  return { revOf, noteSaved };
}
