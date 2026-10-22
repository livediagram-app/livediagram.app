'use client';

import { useEffect } from 'react';

// An Explorer withheld while open (a phone turned sideways, docs/specs/007-editor/live-app.md "A phone held
// sideways") closes, so it is not still open, anchored to a menu button that has gone, when the phone is
// turned upright again; and one opened while withheld closes straight away.
export function useWithheldExplorerCloses(withheld: boolean, open: boolean, close: () => void) {
  useEffect(() => {
    if (withheld && open) close();
  }, [withheld, open, close]);
}
