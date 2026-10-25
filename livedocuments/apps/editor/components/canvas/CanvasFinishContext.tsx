'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { resolveFinish, type Finish } from '@livedocuments/document';

// The tab's finish (docs/specs/008-canvas/finish.md): the drawing style every element without its own is
// drawn in. A context for the same reasons as CanvasSurfaceContext: the element views are React.memo'd, and
// a context update still reaches them when the tab's finish changes, with no prop threaded through the
// layer. The editor provides the active tab's; each canvas provides its own tab's again, so a side-by-side
// pane draws in its tab's finish.
//
// Undefined (no provider, or a tab with none) is Flexible, so a preview tile or a test draws as before.
const CanvasFinishContext = createContext<Finish | undefined>(undefined);

export function CanvasFinishProvider({
  finish,
  children,
}: {
  finish: Finish | undefined;
  children: ReactNode;
}) {
  return <CanvasFinishContext.Provider value={finish}>{children}</CanvasFinishContext.Provider>;
}

/** The tab's own finish, undefined when it has none (Flexible). */
export function useTabFinish(): Finish | undefined {
  return useContext(CanvasFinishContext);
}

/** The finish an element is drawn in: its own, else its tab's, else Flexible. */
export function useElementFinish(own: unknown): Finish {
  return resolveFinish(own, useContext(CanvasFinishContext));
}
