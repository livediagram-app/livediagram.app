import type { ReactNode } from 'react';
import type { ContentInset } from '@/components/canvas/useIndicatorLayout';

// The element's content area pulled in from its top and bottom to clear its indicators
// (docs/specs/008-canvas/element-indicators.md) and to keep to its label body (a cylinder's, under
// its lid: docs/specs/008-canvas/canvas-and-palette.md "Shape primitives"). The label and icon
// layouts position themselves `absolute inset-0`, so a positioned box that starts lower (or ends
// higher) moves them with it. No inset renders the content as it was, with no extra box.
export function InsetContent({ inset, children }: { inset?: ContentInset; children: ReactNode }) {
  if (!inset || (inset.top === 0 && inset.bottom === 0)) return <>{children}</>;
  return (
    <div className="absolute inset-x-0" style={{ top: inset.top, bottom: inset.bottom }}>
      {children}
    </div>
  );
}

/** The inset that clears every one given: the deepest on each side. */
export function clearingInset(...insets: (ContentInset | undefined)[]): ContentInset {
  return insets.reduce<ContentInset>(
    (acc, inset) => ({
      top: Math.max(acc.top, inset?.top ?? 0),
      bottom: Math.max(acc.bottom, inset?.bottom ?? 0),
    }),
    { top: 0, bottom: 0 },
  );
}
