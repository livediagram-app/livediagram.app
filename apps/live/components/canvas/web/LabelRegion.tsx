import type { ReactNode } from 'react';
import type { LayoutRect } from '@livediagram/diagram';
import { rectStyle } from '@/components/canvas/web/web-face-props';

// Where a web component puts its label (spec/147): the shared label node,
// confined to one region of the element instead of the whole box.
export function LabelRegion({ rect, children }: { rect: LayoutRect; children: ReactNode }) {
  return (
    <div className="absolute" style={rectStyle(rect)}>
      {children}
    </div>
  );
}
