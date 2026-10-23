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

// The finish of the element whose face is being drawn (docs/specs/008-canvas/finish.md "Faces"), provided by the
// element's view (BoxedElementView, and a Plan body drawn over the canvas): the face's own parts that draw a look
// inline, where the face stylesheet (app/face-finish.css) cannot reach it, read it here. Flexible outside a face.
const FaceFinishContext = createContext<Finish>('flexible');

export function FaceFinishProvider({ finish, children }: { finish: Finish; children: ReactNode }) {
  return <FaceFinishContext.Provider value={finish}>{children}</FaceFinishContext.Provider>;
}

/** The finish the face being drawn is in; Flexible outside an element. */
export function useFaceFinish(): Finish {
  return useContext(FaceFinishContext);
}
