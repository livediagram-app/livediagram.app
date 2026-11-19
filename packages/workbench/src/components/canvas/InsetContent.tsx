import type { ReactNode } from 'react';

// How far the content area pulls in from the element's top and bottom, and from each side (a slanted
// kind's label body: labelBodyInset).
export type ContentInset = { top: number; bottom: number; side?: number };

// The element's content area pulled in from its top and bottom to clear its indicators
// (docs/specs/008-canvas/element-indicators.md) and to keep to its label body (a cylinder's, under
// its lid: docs/specs/008-canvas/canvas-and-palette.md "Shape primitives"). The label and icon
// layouts position themselves `absolute inset-0`, so a positioned box that starts lower (or ends
// higher) moves them with it. No inset renders the content as it was, with no extra box.
export function InsetContent({ inset, children }: { inset?: ContentInset; children: ReactNode }) {
  const side = inset?.side ?? 0;
  if (!inset || (inset.top === 0 && inset.bottom === 0 && side === 0)) return <>{children}</>;
  return (
    <div
      data-label-body=""
      className="absolute"
      style={{ top: inset.top, bottom: inset.bottom, left: side, right: side }}
    >
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
      side: Math.max(acc.side ?? 0, inset?.side ?? 0),
    }),
    { top: 0, bottom: 0, side: 0 },
  );
}
