import type { SVGProps } from 'react';
import { pv } from './motion';

// Small building blocks the preview hover stories share (preview-motion.css).

// A dot a story adds: hidden at rest, popped in at `at` ms.
export function PopDot({ at, ...rest }: { at: number } & SVGProps<SVGCircleElement>) {
  return <circle className="pv-new" opacity="0" style={pv({ '--pv-at': `${at}ms` })} {...rest} />;
}
