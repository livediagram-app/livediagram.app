'use client';

import { useState } from 'react';

// Whether the header and the tab bar show on a phone held sideways (docs/specs/007-editor/editor-app.md,
// live-app.md in livedesign, "A phone held sideways"). Only a flag: the fold itself is CSS (the `landscape-phone:` variant on
// LandscapeBarFold), so this never reads the screen and costs nothing on any other device, where the
// flag changes nothing on screen.
//
// - `shown` starts false (folded) for each load and is never saved or synced.
// - A change in any of `revealKeys` (the editor's Rename and Rename Tab nonces) shows the bars first, in
//   the same render, so the rename field is on screen when it takes the focus.
// - A tour on screen keeps them shown: a tour's Tabs step points at the tab bar.
// Each editor binds it once, at module scope in its `hooks/ui/useLandscapeBars.ts`, with the tour store its tours
// publish to (lib/tour-active) and its telemetry.
export function createLandscapeBars({
  useActiveTour,
  track,
}: {
  useActiveTour: () => unknown;
  track: (category: 'UI', action: 'Toggled', type: 'LandscapeBarsOn' | 'LandscapeBarsOff') => void;
}) {
  return function useLandscapeBars(revealKeys: readonly (string | number)[]): {
    shown: boolean;
    toggle: () => void;
  } {
    const [chosen, setChosen] = useState(false);
    const key = revealKeys.join('|');
    const [lastKey, setLastKey] = useState(key);
    if (key !== lastKey) {
      setLastKey(key);
      setChosen(true);
    }
    const tourShowing = useActiveTour() !== null;
    const shown = chosen || tourShowing;
    const toggle = () => {
      const next = !shown;
      track('UI', 'Toggled', next ? 'LandscapeBarsOn' : 'LandscapeBarsOff');
      setChosen(next);
    };
    return { shown, toggle };
  };
}
