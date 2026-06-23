'use client';

import { useState } from 'react';

// Shared "Show more" opt-in pattern used by the template picker
// (templates + themes) and the Tab Appearance modal's background-pattern
// picker. Auto-expands when the active entry sits in the hidden
// batch so the user always sees their current selection.
//
// `activeMatch` is the predicate that identifies the active entry
// from the list (e.g. `(t) => t.kind === templateKind` or
// `(p) => p.id === backgroundPattern`).
//
// Two ways to decide what's hidden behind the toggle:
//   - Flag mode (default): entries tagged `extra: true` are hidden.
//     Order-independent — the same items always render up front. Used
//     by the pattern picker where the catalogue order is stable.
//   - Count mode (`initialCount` given): the first `initialCount`
//     entries render and the rest hide, regardless of any `extra`
//     flag. Pairs with a shuffled list (see lib/shuffle.ts) so the
//     template picker can rotate which options greet the user while
//     keeping the first batch compact.
export function useShowMoreList<T extends { extra?: boolean }>(
  items: T[],
  activeMatch: (item: T) => boolean,
  initialCount?: number,
): {
  visible: T[];
  hasMore: boolean;
  showAll: boolean;
  reveal: () => void;
} {
  const limited = initialCount !== undefined;
  const [showAll, setShowAll] = useState(() =>
    limited
      ? items.findIndex(activeMatch) >= initialCount
      : items.find(activeMatch)?.extra === true,
  );
  return {
    visible: limited
      ? showAll
        ? items
        : items.slice(0, initialCount)
      : items.filter((i) => !i.extra || showAll),
    hasMore: limited ? items.length > initialCount : items.some((i) => i.extra),
    showAll,
    reveal: () => setShowAll(true),
  };
}
