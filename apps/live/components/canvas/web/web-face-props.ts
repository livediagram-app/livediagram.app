import type { ReactNode } from 'react';
import type { LayoutRect, ShapeElement, WebRows } from '@livediagram/diagram';

// What every web component face (spec/147) is handed by ElementFaceRouter.
export type WebFaceProps = {
  element: ShapeElement;
  // The element's label, rendered by the shared label path (so double-click
  // edits it with the normal editor). It positions itself `absolute inset-0`,
  // so a face places it by wrapping it in a region.
  labelNode: ReactNode;
  // Resolved colours: the stroke (the theme accent on a fresh one), the fill
  // and the label's colour.
  accent: string;
  fill: string;
  textColor: string;
  fontFamily: string | undefined;
  zoom: number;
  // Whether the secondary lines are editable in place: selected, and neither
  // read-only nor locked. The first click selects, the next one edits.
  editable: boolean;
  onSetRows: (rows: WebRows) => void;
  onSetHeading: (field: 'pageTitle' | 'pageSubtitle', value: string) => void;
};

// A layout rect as absolute CSS, element-relative.
export function rectStyle(r: LayoutRect) {
  return { left: r.x, top: r.y, width: r.width, height: r.height } as const;
}
