'use client';

import { createContext, useContext } from 'react';
import type { BoxedElement, CanvasSurface } from '@livedesign/design';
import type { InspectExportFormat, InspectExportScale } from '@/lib/inspect-export';

// What the Inspect panel needs from the editor beyond the canvas it sits in
// (docs/specs/007-editor/wireframe-pages.md "The Inspect panel"): exporting an element, and copying the link that
// opens with Inspect. Provided by EditorCanvasHost (useInspectSession) as a stable value whose functions read the
// editor through refs, so the memoised canvas never re-renders for it.
export type InspectSession = {
  exportElement: (input: {
    el: BoxedElement;
    elementName: string;
    format: InspectExportFormat;
    scale: InspectExportScale;
    surface: CanvasSurface;
  }) => Promise<void>;
  // Null where there is no link to copy (a design kept in This Browser).
  copyLink: (() => Promise<void>) | null;
};

export const InspectSessionContext = createContext<InspectSession | null>(null);

export function useInspectSession(): InspectSession | null {
  return useContext(InspectSessionContext);
}
