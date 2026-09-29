'use client';

// Per-user diagram favourites (docs/specs/013-workspace/favourites.md), shared by the Explorer page and
// the editor's Explorer panel so the two can't drift on what a star means.
//
// The set is fetched once per owner and then kept in memory. Toggling is
// OPTIMISTIC: the star flips immediately and the request goes out behind
// it. Starring is a bookmark, not a mutation of anything anyone can see —
// the worst case for a failed write is a star that doesn't survive a
// reload, which is a better trade than a UI that stalls on every click.

import { useCallback, useEffect, useState } from 'react';
import { apiListFavourites, apiSetFavourite } from '@/lib/api-client';
import { useLatest } from '@/hooks/ui/useLatest';

export function useFavourites(ownerId: string | null) {
  const [favouriteIds, setFavouriteIds] = useState<Set<string>>(() => new Set());
  // Mirror for the toggle below. It needs to READ the current set to
  // decide the direction, and a state updater is the wrong place to do
  // that: React may run it during a later render pass, so anything
  // captured from inside it is unsafe to use for the outbound request.
  const idsRef = useLatest(favouriteIds);

  // No owner, no stars: dropped during render the moment the owner goes.
  const [loadedOwner, setLoadedOwner] = useState(ownerId);
  if (ownerId !== loadedOwner) {
    setLoadedOwner(ownerId);
    if (!ownerId) setFavouriteIds(new Set());
  }

  useEffect(() => {
    if (!ownerId) return;
    let cancelled = false;
    void apiListFavourites(ownerId).then((ids) => {
      if (!cancelled) setFavouriteIds(new Set(ids));
    });
    return () => {
      cancelled = true;
    };
  }, [ownerId]);

  const toggleFavourite = useCallback(
    (documentId: string) => {
      if (!ownerId) return;
      const next = !idsRef.current.has(documentId);
      const optimistic = new Set(idsRef.current);
      if (next) optimistic.add(documentId);
      else optimistic.delete(documentId);
      // Update the ref too, so a second click before the re-render lands
      // reads the value this one just chose rather than the old one.
      idsRef.current = optimistic;
      setFavouriteIds(optimistic);
      void apiSetFavourite(ownerId, documentId, next);
    },
    [idsRef, ownerId],
  );

  return { favouriteIds, toggleFavourite };
}
