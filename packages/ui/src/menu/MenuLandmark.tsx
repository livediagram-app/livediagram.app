'use client';

import type { ReactNode } from 'react';
import { accessibleNameOf } from '../hint/trigger-text';

// A command menu portalled to the body belongs to no landmark, so axe's "region" rule finds its rows outside one
// and a screen reader's landmark list has no way to it (docs/specs/004-interface-design/menus.md "Semantics"). Every
// portalled command menu stands in this named region. A control menu needs none: it is a dialog, which counts as one.
// The name is the one given, else the trigger's (as the menu's own is), else "Menu".
export function menuLandmarkName(name?: string, trigger?: Element | null): string {
  if (name) return name;
  return (trigger ? accessibleNameOf(trigger) : '') || 'Menu';
}

export function MenuLandmark({
  name,
  trigger,
  children,
}: {
  name?: string | undefined;
  trigger?: Element | null | undefined;
  children: ReactNode;
}) {
  return (
    <div role="region" aria-label={menuLandmarkName(name, trigger)}>
      {children}
    </div>
  );
}
