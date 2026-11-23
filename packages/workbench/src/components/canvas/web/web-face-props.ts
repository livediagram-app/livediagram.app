import type { ReactNode } from 'react';
import type { LayoutRect, WebRows } from '@liveworkspace/element-model/web-components';
import type { ShapeElement } from '@liveworkspace/element-model/element';

// What every web component face (docs/specs/009-elements/web-components-and-no-groups.md) is handed by ElementFaceRouter.
// `E` is the editor's own shape where a face reads fields the shared element model does not name.
export type WebFaceProps<E extends ShapeElement = ShapeElement> = {
  element: E;
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
  // Whether the secondary lines are editable in place: selected, and neither
  // read-only nor locked. The first click selects, the next one edits.
  editable: boolean;
  onSetRows: (rows: WebRows) => void;
  onSetHeading: (field: 'pageTitle' | 'pageSubtitle', value: string) => void;
  // Who reads the document's pictures, for a quote's photo (docs/specs/009-elements/quote.md); absent where pictures
  // are not shown (a preview with no document).
  imageContext?: { ownerId: string; documentId: string; shareCode: string | null };
};

// A layout rect as absolute CSS, element-relative.
export function rectStyle(r: LayoutRect) {
  return { left: r.x, top: r.y, width: r.width, height: r.height } as const;
}
