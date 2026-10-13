'use client';

import { useMediaQuery } from '@livediagram/ui';

// Whether the bottom-right cluster names its buttons beside their icons (docs/specs/007-editor/
// live-app.md "Named on a wide desktop"): only from this width up. Narrower, a laptop's canvas
// would lose its lower middle to the names (at 1280 px the named strips reach x 446), so the
// buttons stay icons, as on a phone.
export const DOCK_NAMES_MIN_WIDTH = 1440;
const QUERY = `(min-width: ${DOCK_NAMES_MIN_WIDTH}px)`;

export function useDockNames(): boolean {
  return useMediaQuery(QUERY);
}
