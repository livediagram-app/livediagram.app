'use client';

import { useState } from 'react';

// Shared "Show more" opt-in pattern used by the template picker
// (templates + themes) and the Current Tab section (themes +
// patterns). Every consumer carries a flat list where some entries
// are tagged `extra: true`; the toggle controls whether those
// render. Auto-expands when the active entry is itself an extra so
// the user always sees their current selection.
//
// `activeMatch` is the predicate that identifies the active entry
// from the list (e.g. `(t) => t.kind === templateKind` or
// `(p) => p.id === backgroundPattern`).
export function useShowMoreList<T extends { extra?: boolean }>(
  items: T[],
  activeMatch: (item: T) => boolean,
): {
  visible: T[];
  hasMore: boolean;
  showAll: boolean;
  reveal: () => void;
} {
  const [showAll, setShowAll] = useState(() => items.find(activeMatch)?.extra === true);
  return {
    visible: items.filter((i) => !i.extra || showAll),
    hasMore: items.some((i) => i.extra),
    showAll,
    reveal: () => setShowAll(true),
  };
}
