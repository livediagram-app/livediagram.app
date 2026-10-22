'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { tagColoursOf, type TagColour } from '@liveplanner/project';

// The active tab's tag colours (docs/specs/009-elements/tag-colours.md) for the cards that render them: a mapped card's
// accent edge and its tinted chips. Read at render, never stored on the card. Its identity holds while the map does, so
// a change elsewhere on the tab re-renders no card through it.
const TagColoursContext = createContext<readonly TagColour[] | undefined>(undefined);

export function TagColoursProvider({
  tab,
  children,
}: {
  tab: { tagColours?: unknown };
  children: ReactNode;
}) {
  const map = tagColoursOf(tab);
  const key = map.map((r) => `${r.tag}:${r.color}`).join('|');
  // oxlint-disable-next-line react/exhaustive-deps -- keyed on the rows, not the array
  const stable = useMemo(() => (map.length ? map : undefined), [key]);
  return <TagColoursContext.Provider value={stable}>{children}</TagColoursContext.Provider>;
}

export function useTagColours(): readonly TagColour[] | undefined {
  return useContext(TagColoursContext);
}
