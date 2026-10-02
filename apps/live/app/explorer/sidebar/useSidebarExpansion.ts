import { useCallback, useState } from 'react';
import type { SelectedNode } from '../views';
import { initialExpanded, isLibraryView, LIBRARY_EXPAND_KEY } from './sidebar-structure';

// Which sidebar rows are open (docs/specs/013-workspace/explorer-structure.md#expansion): one
// session-local set of folder ids, team ids and the two fixed keys, shared by
// the desktop sidebar and the mobile drawer. My documents starts open; Library
// starts open on a Library page and opens whenever one becomes current.
export function useSidebarExpansion(selected: SelectedNode) {
  const [expanded, setExpanded] = useState<Set<string>>(() => initialExpanded(selected));
  const [seenKind, setSeenKind] = useState(selected.kind);

  // Adjusted during render rather than in an effect, so the row is open in
  // the same paint that lands on the page.
  if (seenKind !== selected.kind) {
    setSeenKind(selected.kind);
    if (isLibraryView(selected.kind) && !expanded.has(LIBRARY_EXPAND_KEY))
      setExpanded(new Set(expanded).add(LIBRARY_EXPAND_KEY));
  }

  // Open a row (no-op when it already is): a new folder's parent.
  const expand = useCallback((key: string) => {
    setExpanded((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
  }, []);

  const toggleExpand = useCallback((key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  return { expanded, expand, toggleExpand };
}
