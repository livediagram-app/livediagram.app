import type { ReactNode } from 'react';
import type { LayoutRect } from '@livedocuments/document';
import { rectStyle } from '@/components/canvas/web/web-face-props';

// Where a web component puts its label (docs/specs/009-elements/web-components-and-no-groups.md): the shared label node,
// confined to one region of the element instead of the whole box.
// `tourId` names it for an element tour step to point at (a cycle's middle, a hub's hub).
export function LabelRegion({
  rect,
  tourId,
  children,
}: {
  rect: LayoutRect;
  tourId?: string;
  children: ReactNode;
}) {
  return (
    <div className="absolute" style={rectStyle(rect)} data-tour-part={tourId}>
      {children}
    </div>
  );
}
