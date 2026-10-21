import type { CSSProperties, SVGProps } from 'react';
import { pv } from './motion';

// Small building blocks the preview hover stories share (preview-motion.css).

// A transformed <g> scales and moves round its own box, not the SVG origin.
export const FILL_BOX = { transformBox: 'fill-box', transformOrigin: 'center' } as const;

// A story group that pops in at `at` ms (give it className="pv-new" and
// opacity="0", so it's hidden at rest).
export const popGroup = (at: number): CSSProperties => ({
  ...pv({ '--pv-at': `${at}ms` }),
  ...FILL_BOX,
});

// A shape a story adds: hidden at rest, popped in at `at` ms.
export function Pop({ at, ...rest }: { at: number } & SVGProps<SVGRectElement>) {
  return <rect className="pv-new" opacity="0" style={pv({ '--pv-at': `${at}ms` })} {...rest} />;
}

export function PopDot({ at, ...rest }: { at: number } & SVGProps<SVGCircleElement>) {
  return <circle className="pv-new" opacity="0" style={pv({ '--pv-at': `${at}ms` })} {...rest} />;
}
