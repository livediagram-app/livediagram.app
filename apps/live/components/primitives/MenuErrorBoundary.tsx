'use client';

import type { ReactNode } from 'react';
import { AreaErrorBoundary } from './AreaErrorBoundary';

// A context menu is a transient overlay: if something inside it throws while
// rendering, the right outcome is that the MENU goes away, not the editor.
// Without this a single bad render in the tab / canvas menu unmounted the
// whole page (the "page crashes when I open the tab menu" report). The
// boundary swallows the fault, logs it, reports it as `Render.Menu.*`
// (spec/22), and asks the owner to close the menu, so the next open starts
// from a clean mount.
export function MenuErrorBoundary({
  onError,
  children,
}: {
  onError: () => void;
  children: ReactNode;
}) {
  return (
    <AreaErrorBoundary area="Menu" onError={onError}>
      {children}
    </AreaErrorBoundary>
  );
}
