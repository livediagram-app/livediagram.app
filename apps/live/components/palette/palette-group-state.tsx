'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

// Which collapsible tile group is open, shared across the palette.
//
// At most ONE at a time. Behaviour carries two groups (Session and Reactions,
// spec/105 and spec/135) holding eight tiles between them, and with both open
// the category ran well past the panel — the reader ends up scrolling a list
// they opened precisely to avoid scrolling. Opening one closes the other, the
// way the element context menu's accordion sections already behave.
//
// Lifted into a context rather than held per group for the same reason that
// menu lifted its own: a group cannot close a sibling it has no reference to,
// and threading "which is open" through every tab body would put palette state
// in four components that have no other use for it.
//
// The state lives ABOVE the tabs, so switching category and coming back finds
// the group as you left it.

type PaletteGroupState = {
  openId: string | null;
  toggle: (id: string) => void;
};

// A null context rather than a default value: `usePaletteGroup` falls back to
// its own local state when there is no provider, so a PaletteTileGroup used
// outside the palette (a test, a future surface) still opens and closes.
const Ctx = createContext<PaletteGroupState | null>(null);

export function PaletteGroupProvider({ children }: { children: React.ReactNode }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const toggle = useCallback((id: string) => {
    setOpenId((current) => (current === id ? null : id));
  }, []);
  const value = useMemo(() => ({ openId, toggle }), [openId, toggle]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** `[isOpen, toggle]` for one group, coordinated when a provider is present. */
export function usePaletteGroup(id: string): [boolean, () => void] {
  const shared = useContext(Ctx);
  const [localOpen, setLocalOpen] = useState(false);
  const toggleLocal = useCallback(() => setLocalOpen((o) => !o), []);
  const toggleShared = useCallback(() => shared?.toggle(id), [shared, id]);
  return shared ? [shared.openId === id, toggleShared] : [localOpen, toggleLocal];
}
